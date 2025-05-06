import uuid
import json
import sqlite3
from datetime import datetime
from flask import Flask, request
from flask_socketio import SocketIO, emit, send, join_room
import time

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
    player_id = data['player_id']

    full_board_info = {
        "board": data["board"],
        "ships": data.get("ships", [])
    }
    board_json = json.dumps(full_board_info)

    is_ai_game = data.get('is_ai_game', False)

    room = db.execute("SELECT * FROM game WHERE status = 'waiting' AND ai_field = 0 LIMIT 1").fetchone()

    if room and not is_ai_game:
        room_id = room['room_id']
        db.execute("""
            UPDATE game SET player2_id = ?, player2_board = ?, status = 'playing', last_activity = ?
            WHERE room_id = ?
        """, (player_id, board_json, datetime.now(), room_id))
        conn.commit()

        join_room(room_id)
        emit('match_success', {'room_id': room_id, 'player': 'player2'}, to=room['player1_id'])
        emit('match_success', {'room_id': room_id, 'player': 'player2'})

        import random
        first_turn = random.choice([room['player1_id'], player_id])
        db.execute("UPDATE game SET current_turn = ? WHERE room_id = ?", (first_turn, room_id))
        conn.commit()
        socketio.emit('game_started', {'first_turn': first_turn}, room=room_id)

    else:
        room_id = str(uuid.uuid4())
        player2_id = "ai" if is_ai_game else None
        player2_board_json = None
        ai_turn_array = None

        if is_ai_game:
            from ai.evaluate_method import evaluate
            from ai.battleship_board import generate_board
            ai_setup = generate_board()
            player2_board_json = json.dumps(ai_setup)
            ai_moves = evaluate(board=data['board'])
            ai_turn_array = json.dumps(ai_moves)

        db.execute("""
            INSERT INTO game (
                room_id, player1_id, player2_id,
                player1_board, player2_board,
                status, ai_field, ai_turn_array,
                created_at, last_activity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            room_id, player_id, player2_id,
            board_json, player2_board_json,
            'playing' if is_ai_game else 'waiting',
            is_ai_game, ai_turn_array,
            datetime.now(), datetime.now()
        ))
        conn.commit()

        join_room(room_id)
        emit('joined_game', {'room_id': room_id, 'status': 'playing' if is_ai_game else 'waiting'})

        import random
        first_turn = random.choice([player_id, 'ai']) if is_ai_game else None
        if first_turn:
            db.execute("UPDATE game SET current_turn = ? WHERE room_id = ?", (first_turn, room_id))
            conn.commit()
            socketio.emit('game_started', {'first_turn': first_turn}, room=room_id)
            if first_turn == 'ai':
                socketio.start_background_task(ai_auto_play, room_id)
        else:
            emit('waiting_for_opponent', {'message': '等待對手加入...'}, room=room_id)

@socketio.on('update_board')
def handle_update_board(data):
    room_id = data['room_id']
    room = db.execute("SELECT * FROM game WHERE room_id = ?", (room_id,)).fetchone()
    if not room:
        emit('error', {'message': '房間不存在'})
        return

    emit('board_update', {
        'player1': json.loads(room['player1_board']),
        'player2': json.loads(room['player2_board']),
        'is_ai_game': room['ai_field']
    })

@socketio.on('make_move')
def handle_make_move(data):
    room_id = data.get('room_id')
    player = data.get('player')
    x, y = data.get('x'), data.get('y')

    if not all([room_id, player]) or x is None or y is None:
        emit('error', {'message': '缺少參數喵'})
        return

    while True:
        room = db.execute("SELECT * FROM game WHERE room_id = ?", (room_id,)).fetchone()
        if not room:
            emit('error', {'message': '找不到房間喵'})
            return

        if room['current_turn'] != player:
            emit('error', {'message': '還沒輪到你喵'})
            return

        opponent_board_key = 'player2_board' if player == room['player1_id'] else 'player1_board'
        opponent_data = json.loads(room[opponent_board_key])
        board = opponent_data["board"]

        hit = board[x][y] == 1
        board[x][y] = 2 if hit else 3
        opponent_data["board"] = board

        next_turn = player if hit else (
            room['player1_id'] if player == room['player2_id'] else room['player2_id']
        )
        db.execute(f"""
            UPDATE game
            SET {opponent_board_key} = ?, current_turn = ?
            WHERE room_id = ?
        """, (json.dumps(opponent_data), next_turn, room_id))
        conn.commit()

        socketio.emit('move_made', {
            'attacker': player,
            'x': x,
            'y': y,
            'hit': hit
        }, room=room_id)

        if all(cell != 1 for row in board for cell in row):
            db.execute("UPDATE game SET status = 'finished', winner_id = ? WHERE room_id = ?", (player, room_id))
            conn.commit()
            socketio.emit('game_over', {'winner': player}, room=room_id)
            return

        if not hit:
            break
        else:
            break

    if room['ai_field'] and next_turn == 'ai':
        socketio.start_background_task(ai_auto_play, room_id)

def process_ai_move(room_id):
    room = db.execute("SELECT * FROM game WHERE room_id = ?", (room_id,)).fetchone()
    if not room or room['current_turn'] != 'ai':
        return False

    ai_turns = json.loads(room['ai_turn_array'] or '[]')
    if not ai_turns:
        return False

    ai_x, ai_y = ai_turns.pop(0)
    player_data = json.loads(room['player1_board'])
    board = player_data["board"]
    hit = board[ai_x][ai_y] == 1
    board[ai_x][ai_y] = 2 if hit else 3
    player_data["board"] = board

    next_turn = 'ai' if hit else room['player1_id']
    db.execute("""
        UPDATE game
        SET player1_board = ?, ai_turn_array = ?, current_turn = ?
        WHERE room_id = ?
    """, (json.dumps(player_data), json.dumps(ai_turns), next_turn, room_id))
    conn.commit()

    socketio.emit('move_made', {
        'attacker': 'ai',
        'x': ai_x,
        'y': ai_y,
        'hit': hit
    }, room=room_id)

    if all(cell != 1 for row in board for cell in row):
        db.execute("UPDATE game SET status = 'finished', winner_id = 'ai' WHERE room_id = ?", (room_id,))
        conn.commit()
        socketio.emit('game_over', {'winner': 'ai'}, room=room_id)
        return False

    updated_room = db.execute("SELECT current_turn FROM game WHERE room_id = ?", (room_id,)).fetchone()
    if updated_room['current_turn'] != 'ai':
        return False

    return hit

def ai_auto_play(room_id):
    while True:
        time.sleep(1)
        keep_shooting = process_ai_move(room_id)
        if not keep_shooting:
            break

@app.route('/api/sunken_ships', methods=['POST'])
def get_sunken_ships():
    data = request.get_json()
    room_id = data.get("room_id")
    player = data.get("player")

    if not room_id or player not in ["player1", "player2"]:
        return {"error": "缺少參數喵"}, 400

    room = db.execute("SELECT * FROM game WHERE room_id = ?", (room_id,)).fetchone()
    if not room:
        return {"error": "找不到房間喵"}, 404

    board_key = f"{player}_board"
    try:
        board_data = json.loads(room[board_key])
        sunk = check_sunken_ships(board_data)
        return {
            "sunken_ship_ids": sunk,
            "total_ships": len(board_data["ships"]),
            "sunken_count": len(sunk),
        }
    except Exception as e:
        return {"error": f"解析失敗喵：{str(e)}"}, 500

def check_sunken_ships(board_data):
    board = board_data["board"]
    sunken_ships = []
    for ship in board_data["ships"]:
        size = ship["size"]
        row, col = ship["row"], ship["col"]
        orientation = ship["orientation"]

        cells = []
        if orientation == "horizontal":
            cells = [(row, col + i) for i in range(size)]
        else:
            cells = [(row + i, col) for i in range(size)]

        if all(board[r][c] == 2 for r, c in cells):
            sunken_ships.append(ship["id"])

    return sunken_ships

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)