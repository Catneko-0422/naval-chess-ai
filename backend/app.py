from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
import os
import random
from collections import defaultdict
from ai import NavalChessAI

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////app/instance/naval_chess.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 確保實例目錄存在
os.makedirs('/app/instance', exist_ok=True)

db = SQLAlchemy(app)
socketio = SocketIO(app, 
    cors_allowed_origins=["https://naval-frontend.nekocat.cc"], 
    path="/socket.io",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1e8,
    allow_upgrades=True,
    transports=['websocket', 'polling']
)

# 數據庫模型
class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.String(50), unique=True, nullable=False)
    player1_id = db.Column(db.String(50))
    player2_id = db.Column(db.String(50))
    player1_board = db.Column(db.Text)
    player2_board = db.Column(db.Text)
    current_turn = db.Column(db.String(50))
    status = db.Column(db.String(20))  # 'waiting', 'playing', 'finished'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    player1_rating = db.Column(db.Integer, default=1000)
    player2_rating = db.Column(db.Integer, default=1000)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    is_ai_game = db.Column(db.Boolean, default=False)
    ai_difficulty = db.Column(db.String(20))  # 'easy', 'medium', 'hard'

class Player(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    rating = db.Column(db.Integer, default=1000)
    wins = db.Column(db.Integer, default=0)
    losses = db.Column(db.Integer, default=0)
    last_online = db.Column(db.DateTime, default=datetime.utcnow)

# 創建數據庫表
with app.app_context():
    db.create_all()

# 存儲在線玩家和等待匹配的玩家
online_players = {}
waiting_players = defaultdict(list)  # 按技能等級分組的等待玩家
ai_instances = {}  # 存儲AI實例

def get_rating_range(rating):
    """根據玩家評分返回匹配範圍"""
    return max(100, min(500, int(rating * 0.2)))

def create_ai_instance(difficulty):
    """創建AI實例"""
    if difficulty not in ai_instances:
        # 根據難度選擇對應的模型
        model_path = f'/app/models/naval_chess_ai_{difficulty}.pt'
        ai = NavalChessAI(model_path=model_path)
        ai_instances[difficulty] = ai
    return ai_instances[difficulty]

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    player_id = request.sid
    if player_id in online_players:
        room_id = online_players[player_id]
        game = Game.query.filter_by(room_id=room_id).first()
        if game:
            # 更新最後活動時間
            game.last_activity = datetime.utcnow()
            db.session.commit()
            
            # 通知對手玩家斷線
            emit('player_disconnected', {'player_id': player_id}, room=room_id)
            
            # 如果斷線超過30秒，結束遊戲
            def end_game_if_disconnected():
                game = Game.query.filter_by(room_id=room_id).first()
                if game and (datetime.utcnow() - game.last_activity).total_seconds() > 30:
                    game.status = 'finished'
                    db.session.commit()
                    emit('game_ended', {'reason': 'opponent_disconnected'}, room=room_id)
            
            socketio.start_background_task(end_game_if_disconnected)
        
        leave_room(room_id)
        del online_players[player_id]
        
        # 從等待列表中移除
        for rating_range in waiting_players.values():
            if player_id in rating_range:
                rating_range.remove(player_id)

@socketio.on('join_game')
def handle_join_game(data):
    player_id = request.sid
    player = Player.query.get(player_id)
    if not player:
        player = Player(id=player_id, rating=1000)
        db.session.add(player)
        db.session.commit()
    
    rating = player.rating
    rating_range = get_rating_range(rating)
    
    # 尋找合適的對手
    opponent = None
    for r in range(max(100, rating - rating_range), rating + rating_range + 1, 100):
        if r in waiting_players and waiting_players[r]:
            opponent = waiting_players[r].pop(0)
            break
    
    if not opponent:
        # 沒有找到合適的對手，加入等待列表
        waiting_players[rating].append(player_id)
        emit('waiting_for_opponent')
        return
    
    # 找到對手，開始遊戲
    room_id = f"game_{player_id}_{opponent}"
    
    # 創建新遊戲
    game = Game(
        room_id=room_id,
        player1_id=opponent,
        player2_id=player_id,
        status='playing',
        current_turn=opponent,
        player1_rating=Player.query.get(opponent).rating,
        player2_rating=rating
    )
    db.session.add(game)
    db.session.commit()
    
    # 加入房間
    join_room(room_id, opponent)
    join_room(room_id, player_id)
    
    online_players[opponent] = room_id
    online_players[player_id] = room_id
    
    emit('game_started', {
        'room_id': room_id,
        'player1': opponent,
        'player2': player_id,
        'current_turn': opponent
    }, room=room_id)

@socketio.on('start_ai_game')
def handle_start_ai_game(data):
    player_id = request.sid
    difficulty = data.get('difficulty', 'medium')
    
    # 創建AI遊戲
    room_id = f"ai_game_{player_id}"
    
    # 創建新遊戲
    game = Game(
        room_id=room_id,
        player1_id=player_id,
        player2_id='ai',
        status='playing',
        current_turn=player_id,
        player1_rating=Player.query.get(player_id).rating if Player.query.get(player_id) else 1000,
        player2_rating=1000,
        is_ai_game=True,
        ai_difficulty=difficulty
    )
    db.session.add(game)
    db.session.commit()
    
    # 加入房間
    join_room(room_id, player_id)
    online_players[player_id] = room_id
    
    emit('game_started', {
        'room_id': room_id,
        'player1': player_id,
        'player2': 'ai',
        'current_turn': player_id
    }, room=room_id)

@socketio.on('update_board')
def handle_update_board(data):
    player_id = request.sid
    room_id = online_players.get(player_id)
    if not room_id:
        return
    
    game = Game.query.filter_by(room_id=room_id).first()
    if not game:
        return
    
    # 更新最後活動時間
    game.last_activity = datetime.utcnow()
    
    # 更新對應玩家的棋盤
    if player_id == game.player1_id:
        game.player1_board = json.dumps(data['board'])
    else:
        game.player2_board = json.dumps(data['board'])
    
    db.session.commit()
    
    # 通知對手
    emit('board_updated', {
        'board': data['board'],
        'player_id': player_id
    }, room=room_id, skip_sid=player_id)

@socketio.on('make_move')
def handle_make_move(data):
    player_id = request.sid
    room_id = online_players.get(player_id)
    if not room_id:
        return
    
    game = Game.query.filter_by(room_id=room_id).first()
    if not game or game.current_turn != player_id:
        return
    
    # 更新最後活動時間
    game.last_activity = datetime.utcnow()
    
    # 更新遊戲狀態
    game.current_turn = game.player2_id if player_id == game.player1_id else game.player1_id
    db.session.commit()
    
    # 通知對手
    emit('move_made', {
        'move': data['move'],
        'next_turn': game.current_turn
    }, room=room_id)
    
    # 如果是AI遊戲且輪到AI
    if game.is_ai_game and game.current_turn == 'ai':
        # 獲取AI實例
        ai = create_ai_instance(game.ai_difficulty)
        
        # 獲取當前棋盤狀態
        player_board = json.loads(game.player1_board)
        ai_board = json.loads(game.player2_board) if game.player2_board else [[0] * 10 for _ in range(10)]
        
        # AI做出移動
        ai_move = ai.make_move(ai_board, player_board)
        if ai_move:
            row, col = ai_move
            
            # 更新AI的棋盤
            ai_board[row][col] = 1 if player_board[row][col] == 1 else 2
            game.player2_board = json.dumps(ai_board)
            
            # 更新遊戲狀態
            game.current_turn = player_id
            db.session.commit()
            
            # 通知玩家AI的移動
            emit('move_made', {
                'move': {'row': row, 'col': col},
                'next_turn': player_id
            }, room=room_id)

@socketio.on('game_over')
def handle_game_over(data):
    player_id = request.sid
    room_id = online_players.get(player_id)
    if not room_id:
        return
    
    game = Game.query.filter_by(room_id=room_id).first()
    if not game:
        return
    
    # 更新遊戲狀態
    game.status = 'finished'
    
    # 更新玩家評分（如果不是AI遊戲）
    if not game.is_ai_game:
        winner_id = data.get('winner_id')
        if winner_id:
            winner = Player.query.get(winner_id)
            loser = Player.query.get(game.player1_id if winner_id == game.player2_id else game.player2_id)
            
            # 簡單的評分更新算法
            rating_diff = abs(winner.rating - loser.rating)
            points = min(32, max(1, int(32 * (1 - rating_diff / 2000))))
            
            winner.rating += points
            winner.wins += 1
            loser.rating -= points
            loser.losses += 1
            
            db.session.commit()
    
    emit('game_ended', {'winner_id': data.get('winner_id')}, room=room_id)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8081) 