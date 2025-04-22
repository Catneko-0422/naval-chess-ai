import uuid
import json
import sqlite3
from datetime import datetime
from flask import Flask, request
from flask_socketio import SocketIO, emit, send, join_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'naval-chess'
socketio = SocketIO(app, cors_allowed_origins="*")

conn = sqlite3.connect('./instance/naval_chess.db', check_same_thread=False)
conn.row_factory = sqlite3.Row
db = conn.cursor()

@app.route('/')
def index():
    return '<h1>WebSocket 伺服器已啟動</h1>'

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('join_game')
def handle_join_game(data):
    '''
    data
    {
        "player_id": "nekocat",
        "board": [[0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,0,0],
                    [1,0,0,0,0,0,0,1,0,0],
                    [1,0,0,0,0,0,0,1,0,0],
                    [1,0,0,0,1,0,0,1,0,0],
                    [1,0,0,0,1,0,0,0,0,1],
                    [1,0,0,0,1,0,0,0,0,1],
                    [0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0],
                    [0,0,1,1,1,0,0,0,0,0]],
        "ships": [{"id":0, "size":2, "row":5, "col":9, "orientation":"horizontal"},
                    {"id":1, "size":3, "row":4, "col":4, "orientation":"vertical"},
                    {"id":2, "size":3, "row":9, "col":2, "orientation":"horizontal"},
                    {"id":3, "size":4, "row":1, "col":7, "orientation":"vertical"},
                    {"id":4, "size":5, "row":2, "col":0, "orientation":"vertical"}],
        "is_ai_game": false
    }
    '''
    player_id = data['player_id']  # 或 data['player_id'] 若你有從前端送上來
    board_json = json.dumps(data['board'])
    is_ai_game = data.get('is_ai_game', False)

    # 嘗試從資料庫找一個正在等待的房間
    room = db.execute("SELECT * FROM game WHERE status = 'waiting' AND ai_field = ? LIMIT 1", (is_ai_game,)).fetchone()

    if room:
        room_id = room['room_id']
        db.execute("""
            UPDATE game SET player2_id = ?, player2_board = ?, status = 'playing', last_activity = ?
            WHERE room_id = ?
        """, (player_id, board_json, datetime.now(), room_id))
        conn.commit()

        join_room(room_id)
        emit('match_success', {'room_id': room_id, 'player': 'player2'}, to=room['player1_id'])
        emit('match_success', {'room_id': room_id, 'player': 'player2'})
        print(f"玩家加入房間UUID：{room_id}")
    else:
        # 建立新房間
        room_id = str(uuid.uuid4())
        db.execute("""
            INSERT INTO game (room_id, player1_id, player1_board, status, ai_field, created_at, last_activity)
            VALUES (?, ?, ?, 'waiting', ?, ?, ?)
        """, (room_id, player_id, board_json, is_ai_game, datetime.now(), datetime.now()))
        conn.commit()

        join_room(room_id)
        emit('joined_game', {'room_id': room_id, 'status': 'waiting'})
        print(f"玩家加入遊戲，創建新房間 UUID：{room_id}")

@socketio.on('update_board')
def handle_update_board(msg):
    pass

@socketio.on('make_move')
def handle_make_move(msg):
    pass

@socketio.on('game_started')
def handle_game_started(msg):
    pass

@socketio.on('move_made')
def handle_move_made(msg):
    pass

@socketio.on('waiting_for_opponent')
def handle_waiting_for_opponent(msg):
    pass

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
