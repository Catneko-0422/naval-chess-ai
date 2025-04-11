from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///naval_chess.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

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

# 創建數據庫表
with app.app_context():
    db.create_all()

# 存儲在線玩家
online_players = {}
waiting_players = []

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    player_id = request.sid
    if player_id in online_players:
        room_id = online_players[player_id]
        leave_room(room_id)
        del online_players[player_id]
        if player_id in waiting_players:
            waiting_players.remove(player_id)
        emit('player_disconnected', {'player_id': player_id}, room=room_id)

@socketio.on('join_game')
def handle_join_game(data):
    player_id = request.sid
    if not waiting_players:
        # 沒有等待的玩家，創建新遊戲
        waiting_players.append(player_id)
        emit('waiting_for_opponent')
    else:
        # 找到對手，開始遊戲
        opponent_id = waiting_players.pop(0)
        room_id = f"game_{player_id}_{opponent_id}"
        
        # 創建新遊戲
        game = Game(
            room_id=room_id,
            player1_id=opponent_id,
            player2_id=player_id,
            status='playing',
            current_turn=opponent_id
        )
        db.session.add(game)
        db.session.commit()
        
        # 加入房間
        join_room(room_id, opponent_id)
        join_room(room_id, player_id)
        
        online_players[opponent_id] = room_id
        online_players[player_id] = room_id
        
        emit('game_started', {
            'room_id': room_id,
            'player1': opponent_id,
            'player2': player_id,
            'current_turn': opponent_id
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
    
    # 更新遊戲狀態
    game.current_turn = game.player2_id if player_id == game.player1_id else game.player1_id
    db.session.commit()
    
    # 通知對手
    emit('move_made', {
        'move': data['move'],
        'next_turn': game.current_turn
    }, room=room_id)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000) 