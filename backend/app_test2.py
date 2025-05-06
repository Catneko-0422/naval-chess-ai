import socketio
import time

# 建立 Socket.IO client
sio = socketio.Client()

room_id = None
my_id = "player1"  # 可改為 "player1"
opponent_id = None
my_turn = False

# --- 事件監聽 ---

@sio.on('connect')
def on_connect():
    print("✅ 已連線到伺服器")

@sio.on('joined_game')
def on_joined_game(data):
    global room_id
    room_id = data['room_id']
    print("🎯 成功創建房間:", data)

@sio.on('match_success')
def on_match(data):
    global room_id, opponent_id
    room_id = data['room_id']
    opponent_id = "player1" if my_id == "player2" else "player2"
    print(f"🎉 配對成功！對手是 {opponent_id}，房間：{room_id}")

@sio.on('game_started')
def on_game_started(data):
    global my_turn
    print("🎮 遊戲開始！先手玩家：", data['first_turn'])
    my_turn = data['first_turn'] == my_id
    if my_turn:
        attack_next()

@sio.on('board_update')
def on_board(data):
    print("📦 目前棋盤：", data)

@sio.on('move_made')
def on_move_made(data):
    global my_turn
    print(f"📍 {data['attacker']} 攻擊 ({data['x']}, {data['y']})，命中？{'✔️' if data['hit'] else '❌'}")
    # 換我出手
    if data['attacker'] != my_id:
        my_turn = True
        time.sleep(1)
        attack_next()

@sio.on('waiting_for_opponent')
def on_waiting(msg):
    print("🕐 等待對手中...")

@sio.on('error')
def on_error(msg):
    print("⚠️ 錯誤：", msg)

# --- 發送出招 ---

def attack_next():
    global room_id, my_id
    x, y = 0, 0  # 測試時固定，正式可用隨機
    print(f"⚔️ {my_id} 攻擊 ({x}, {y})")
    sio.emit('make_move', {
        'room_id': room_id,
        'player': my_id,
        'x': x,
        'y': y
    })

# --- 啟動測試 ---

sio.connect('http://localhost:5000')  # 改成你的伺服器位址喵～

# 加入遊戲（AI 或 PVP 模式）
sio.emit('join_game', {
    "player_id": my_id,
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
    "is_ai_game": False  # 要測 AI 就改 True
})

# 等待遊戲結束（用 while 或 sleep 防止程式提前結束）
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    sio.disconnect()

