import socketio

# 建立 Socket.IO client
sio = socketio.Client()

# 接收到伺服器回應事件
@sio.on('joined_game')
def on_joined_game(data):
    print("收到 joined_game:", data)

# 連接到伺服器（例如本機）
sio.connect('http://0.0.0.0:5000')

# 模擬發送 join_game 事件
sio.emit('join_game', {
    "player_id": "player2",
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
    "is_ai_game": False
})

# 等待事件傳回
sio.sleep(1)  # 等一下回應進來

# 關閉連線
sio.disconnect()