import os
import uuid
import json
import time
import sqlite3
from contextlib import closing
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from ai.utils import check_sunken_ships

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'naval-chess'
socketio = SocketIO(app, cors_allowed_origins="*")

# ----------------------------
# 路徑與資料庫初始化
# ----------------------------
DB_DIR = os.path.join(os.path.dirname(__file__), "instance")
DB_PATH = os.path.join(DB_DIR, "naval_chess.db")

def ensure_instance_dir():
    os.makedirs(DB_DIR, exist_ok=True)

def init_db():
    """確保資料庫與資料表存在；沒有就建"""
    ensure_instance_dir()
    with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
        with closing(conn.cursor()) as cur:
            # 啟用 WAL 改善讀寫並發
            cur.execute("PRAGMA journal_mode=WAL;")

            cur.execute("""
            CREATE TABLE IF NOT EXISTS game (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id VARCHAR(50) NOT NULL UNIQUE,
                player1_id VARCHAR(50),
                player2_id VARCHAR(50),
                player1_board TEXT,
                player2_board TEXT,
                ai_field BOOLEAN DEFAULT 0,
                ai_turn_array TEXT,
                current_turn VARCHAR(50),
                status VARCHAR(20) DEFAULT 'waiting',
                winner_id VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME
            );
            """)

            cur.execute("CREATE INDEX IF NOT EXISTS idx_game_status ON game(status);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_game_current_turn ON game(current_turn);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_game_last_activity ON game(last_activity);")

            cur.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_game_touch_last_activity
            AFTER UPDATE ON game
            BEGIN
                UPDATE game
                SET last_activity = CURRENT_TIMESTAMP
                WHERE id = NEW.id;
            END;
            """)

            conn.commit()

init_db()

# ----------------------------
# 連線/查詢工具（關鍵：不共用全域 cursor/connection）
# ----------------------------
def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    # 再次確保 WAL（若已是 WAL，重設無妨）
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

def fetchone(sql, params=()):
    with closing(get_conn()) as conn, closing(conn.cursor()) as cur:
        cur.execute(sql, params)
        return cur.fetchone()

def fetchall(sql, params=()):
    with closing(get_conn()) as conn, closing(conn.cursor()) as cur:
        cur.execute(sql, params)
        return cur.fetchall()

def execute(sql, params=()):
    with closing(get_conn()) as conn, closing(conn.cursor()) as cur:
        cur.execute(sql, params)
        conn.commit()
        return cur.lastrowid

def executemany(sql, seq_of_params):
    with closing(get_conn()) as conn, closing(conn.cursor()) as cur:
        cur.executemany(sql, seq_of_params)
        conn.commit()

# ----------------------------
# 基本路由
# ----------------------------
@app.route('/')
def index():
    return '<h1>WebSocket 伺服器已啟動</h1>'

# ----------------------------
# Socket.IO 事件
# ----------------------------
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

    room = fetchone("SELECT * FROM game WHERE status = 'waiting' AND ai_field = 0 LIMIT 1")

    if room and not is_ai_game:
        room_id = room['room_id']
        execute("""
            UPDATE game 
            SET player2_id = ?, player2_board = ?, status = 'playing', last_activity = ?
            WHERE room_id = ?
        """, (player_id, board_json, datetime.now(), room_id))

        join_room(room_id)
        # 注意：to=room['player1_id'] 需要對方的 Socket sid；此處沿用原邏輯
        emit('match_success', {'room_id': room_id, 'player': 'player2'}, to=room['player1_id'])
        emit('match_success', {'room_id': room_id, 'player': 'player2'})

        import random
        first_turn = random.choice([room['player1_id'], player_id])
        execute("UPDATE game SET current_turn = ? WHERE room_id = ?", (first_turn, room_id))
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

        execute("""
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

        join_room(room_id)
        emit('joined_game', {'room_id': room_id, 'status': 'playing' if is_ai_game else 'waiting'})

        import random
        first_turn = random.choice([player_id, 'ai']) if is_ai_game else None
        if first_turn:
            execute("UPDATE game SET current_turn = ? WHERE room_id = ?", (first_turn, room_id))
            socketio.emit('game_started', {'first_turn': first_turn}, room=room_id)
            if first_turn == 'ai':
                socketio.start_background_task(ai_auto_play, room_id)
        else:
            emit('waiting_for_opponent', {'message': '等待對手加入...'}, room=room_id)

@socketio.on('update_board')
def handle_update_board(data):
    room_id = data['room_id']
    room = fetchone("SELECT * FROM game WHERE room_id = ?", (room_id,))
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
        emit('error', {'message': '缺少參數'})
        return

    # 讀目前房間狀態
    room = fetchone("SELECT * FROM game WHERE room_id = ?", (room_id,))
    if not room:
        emit('error', {'message': '找不到房間'})
        return

    if room['current_turn'] != player:
        emit('error', {'message': '還沒輪到你'})
        return

    opponent_board_key = 'player2_board' if player == room['player1_id'] else 'player1_board'
    opponent_data = json.loads(room[opponent_board_key])
    board = opponent_data["board"]

    hit = (board[x][y] == 1)
    board[x][y] = 2 if hit else 3
    opponent_data["board"] = board

    next_turn = player if hit else (room['player1_id'] if player == room['player2_id'] else room['player2_id'])

    execute(f"""
        UPDATE game
        SET {opponent_board_key} = ?, current_turn = ?
        WHERE room_id = ?
    """, (json.dumps(opponent_data), next_turn, room_id))

    socketio.emit('move_made', {
        'attacker': player,
        'x': x,
        'y': y,
        'hit': hit
    }, room=room_id)

    if all(cell != 1 for row in board for cell in row):
        execute("UPDATE game SET status = 'finished', winner_id = ? WHERE room_id = ?", (player, room_id))
        socketio.emit('game_over', {'winner': player}, room=room_id)
        return

    # 若是 AI 對戰且輪到 AI，就啟動背景任務
    if room['ai_field'] and next_turn == 'ai':
        socketio.start_background_task(ai_auto_play, room_id)

# ----------------------------
# AI 背景流程（每次操作自行開連線）
# ----------------------------
def process_ai_move(room_id):
    room = fetchone("SELECT * FROM game WHERE room_id = ?", (room_id,))
    if not room or room['current_turn'] != 'ai':
        return False

    ai_turns = json.loads(room['ai_turn_array'] or '[]')
    if not ai_turns:
        return False

    ai_x, ai_y = ai_turns.pop(0)
    player_data = json.loads(room['player1_board'])
    board = player_data["board"]

    hit = (board[ai_x][ai_y] == 1)
    board[ai_x][ai_y] = 2 if hit else 3
    player_data["board"] = board

    next_turn = 'ai' if hit else room['player1_id']

    execute("""
        UPDATE game
        SET player1_board = ?, ai_turn_array = ?, current_turn = ?
        WHERE room_id = ?
    """, (json.dumps(player_data), json.dumps(ai_turns), next_turn, room_id))

    socketio.emit('move_made', {
        'attacker': 'ai',
        'x': ai_x,
        'y': ai_y,
        'hit': hit
    }, room=room_id)

    if all(cell != 1 for row in board for cell in row):
        execute("UPDATE game SET status = 'finished', winner_id = 'ai' WHERE room_id = ?", (room_id,))
        socketio.emit('game_over', {'winner': 'ai'}, room=room_id)
        return False

    updated = fetchone("SELECT current_turn FROM game WHERE room_id = ?", (room_id,))
    return (updated and updated['current_turn'] == 'ai')

def ai_auto_play(room_id):
    while True:
        time.sleep(1)
        keep_shooting = process_ai_move(room_id)
        if not keep_shooting:
            break

# ----------------------------
# REST API
# ----------------------------
@app.route('/api/opponent', methods=['POST'])
def get_opponent():
    data = request.get_json()
    room_id = data.get('room_id')
    player  = data.get('player')

    if not room_id or not player:
        return jsonify({"error": "缺少 room_id 或 player"}), 400

    row = fetchone(
        "SELECT player1_id, player2_id FROM game WHERE room_id = ?",
        (room_id,)
    )
    if not row:
        return jsonify({"error": "找不到房間"}), 404

    p1 = row['player1_id']
    p2 = row['player2_id']

    if player == p1:
        your_side, opponent_side, opponent_id = "player1", "player2", p2
    elif player == p2:
        your_side, opponent_side, opponent_id = "player2", "player1", p1
    else:
        return jsonify({"error": "player 不在此房間"}), 400

    return jsonify({
        "opponent_id":   opponent_id,
        "your_side":     your_side,
        "opponent_side": opponent_side
    }), 200

@app.route('/api/generate_board', methods=['GET'])
def generate_board_api():
    from ai.battleship_board import generate_board
    return jsonify(generate_board())

@app.route('/api/sunken_ships', methods=['POST'])
def get_sunken_ships():
    data = request.get_json()
    room_id = data.get("room_id")
    player = data.get("player")

    if not room_id or player not in ["player1", "player2"]:
        return {"error": "缺少參數"}, 400

    room = fetchone("SELECT * FROM game WHERE room_id = ?", (room_id,))
    if not room:
        return {"error": "找不到房間"}, 404

    board_key = f"{player}_board"
    try:
        board_data = json.loads(room[board_key])
        sunk_ids = check_sunken_ships(board_data)
        sunk_details = [ship for ship in board_data["ships"] if ship["id"] in sunk_ids]
        return {
            "sunken_ship_ids": sunk_ids,
            "sunken_ships": sunk_details,
            "total_ships": len(board_data["ships"]),
            "sunken_count": len(sunk_ids),
        }

    except Exception as e:
        return {"error": f"解析失敗：{str(e)}"}, 500

# ----------------------------
# 進入點
# ----------------------------
if __name__ == '__main__':
    print("Starting backend server...")
    socketio.run(app, host='0.0.0.0', port=5000)
