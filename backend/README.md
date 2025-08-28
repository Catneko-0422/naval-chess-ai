# ⚓️ DQN Naval Chess (backend)

這是一個使用 Flask + Flask-SocketIO + SQLite 的海戰棋（Battleship）遊戲後端，支援 玩家對玩家（PVP） 與 玩家對 AI（PVE），並已針對 SQLite 併發安全做過強化（每次操作自開連線、WAL 模式），此專案(backend)使用uv管理套件

## 技術棧

- Python 3.12+
- Flask
- Flask-SocketIO
- SQLite3

## 專案結構
```bash
.
├─ ai/
│  ├─ battleship_board.py   # 提供 generate_board() -> {board, ships}
│  └─ evaluate_method.py    # 提供 evaluate(board) -> [(x, y), ...]
├─ instance/                # SQLite DB 會自動建立於此
├─ test/                    # 測試用客戶端
│  └─ test_1.py             # 測試客戶端_1
│  └─ test_2.py             # 測試客戶端_2
├─ app.py                   # 程式入口點
└─ README.md
```

## 核心功能

### WebSocket 事件

#### `connect`

- **描述**：客戶端連線成功時觸發。
- **返回**：無。

#### `join_game`

- **描述**：玩家加入遊戲或配對。
- **參數**：

```json
{
  "player_id": "player1",
  "board": [[...]],  // 10x10 整數矩陣，值為 0/1
  "ships": [
    { "id": 0, "size": 2, "row": 5, "col": 9, "orientation": "vertical" },
    ...
  ],
  "is_ai_game": false  // true 表示 PVE 模式
}
```

#### `game_started`

- **描述**：遊戲開始時發送給房間內玩家，包含先手玩家資訊。

```json
{
  "first_turn": "player1"
}
```

#### `make_move`

- **描述**：玩家攻擊指定座標。
- **參數**：

```json
{
  "room_id": "xxx",
  "player": "player1",
  "x": 2,
  "y": 5
}
```

#### `move_made`

- **描述**：回報攻擊結果。

```json
{
  "attacker": "player1",
  "x": 2,
  "y": 5,
  "hit": true
}
```

#### `game_over`

- **描述**：遊戲結束，回傳勝利者。

```json
{
  "winner": "player1"
}
```

#### `waiting_for_opponent`

- **描述**：玩家配對等待中。

---

## REST API

### `POST /api/opponent`

查詢自己在房間裡的身分（your_side）、對手的身分（opponent_side）與對手的 player_id。

- **請求 Body**：

```json
{
  "room_id": "xxx-房間編號xxx",
  "player":  "你自己的 player_id（UUID 或 \"ai\"）"
}
```

- **回應**：

```json
{
  "your_side":     "player1" | "player2",
  "opponent_side": "player1" | "player2",
  "opponent_id":   "對手的 player_id（UUID 或 \"ai\"）"
}
```

### `POST /api/sunken_ships`

查詢擊沉的艦艇 ID。

- **請求 Body**：

```json
{
  "room_id": "xxx",
  "player": "player1" // 查詢player1 or player2玩家的船艦
}
```

- **回應**：

```json
{
  "sunken_ship_ids": [0, 1],
  "sunken_ships": [
    { "id": 0, "size": 2, "row": 5, "col": 9, "orientation": "vertical", "imageId": 2 },
    { "id": 1, "size": 3, "row": 1, "col": 4, "orientation": "horizontal", "imageId": 3 }
  ],
  "total_ships": 5,
  "sunken_count": 2
}
```

### `GET /api/generate_board`

請求初始船艦排佈

- **回應**：

```json
{
  "board": [[...]],  // 10x10 整數矩陣，值為 0/1
  "ships": [
    { "id": 0, "size": 2, "row": 5, "col": 9, "orientation": "vertical" },
    ...
  ]
}
```

---

## 🗄 資料庫結構（SQLite）

```sql
CREATE TABLE game (
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
```

---

## 啟動伺服器

```bash
uv sync
uv run python app.py
```

預設會監聽在 `http://0.0.0.0:5000`

---

## 註解

- 棋盤 `board` 是一個 10x10 的二維陣列，數字代表：

  - `0`: 空白
  - `1`: 有船
  - `2`: 命中
  - `3`: 攻擊失敗

- 每艘船包含 `id`、`size`、起點 `(row, col)` 和方向 `"horizontal"` 或 `"vertical"`。

---

💡 如果想加入 DQN 或其他 AI，請參考 `/ai` 目錄中的邏輯與預設回合處理
