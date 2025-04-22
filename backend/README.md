# Naval Chess WebSocket 伺服器 API 文檔
## 簡介
這是 Naval Chess 遊戲的 WebSocket 伺服器，使用 Flask 和 Flask-SocketIO 實現。伺服器支援玩家加入遊戲、更新棋盤、執行棋步等功能。此文檔描述了各個 WebSocket 事件及其功能。

### 0.``
- **觸發時機:** 
- **功能:** 
- **參數:** 
- **返回:** 

## WebSocket 事件
### 1.`connect`
- **觸發時機:** 當客戶端成功連接到伺服器時。
- **功能:** 打印出 "Client connected" 來通知伺服器有客戶端連接。
- **參數:** 無
- **返回:** 無

### 2.`join_game`
- **觸發時機:** 當玩家希望加入遊戲時，會發送這個事件。
- **功能:** 玩家可以選擇加入一個正在等待的遊戲，或者創建一個新的遊戲房間。伺服器會分配一個 room_id 給玩家，並通知對方玩家。
- **參數:** 
```json
{
  "player_id": "player1",
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
```
- **返回:**    
    - 如果匹配到現有房間，會通知第一位玩家並讓第二位玩家進入遊戲：
        ```json
        {
          "room_id": "room_uuid",
          "player": "player2"
        }
        ```
    - 如果創建新房間，會返回房間的 room_id 和狀態：
        ```json
        {
          "room_id": "room_uuid",
          "status": "waiting"
        }
        ```
### 3.`update_board`
- **觸發時機:** 當玩家更新棋盤時，會發送這個事件。
- **功能:** 更新當前遊戲的棋盤狀態。
- **參數:** 待定，根據遊戲邏輯來決定。
- **返回:** 無

### 4.`make_move`
- **觸發時機:** 當玩家選擇出招時，會發送這個事件。
- **功能:** 玩家進行一次操作，可能是攻擊、移動等。
- **參數:** 待定，根據遊戲邏輯來決定。
- **返回:** 無

### 5.`game_started`
- **觸發時機:** 當遊戲開始時，玩家會收到此事件。
- **功能:** 遊戲開始時會發送的事件，所有玩家會進入對戰狀態。
- **參數:** 待定，根據遊戲邏輯來決定。
- **返回:** 無

### 6.`move_made`
- **觸發時機:** 當一方玩家完成了某個動作（例如攻擊）後，會發送這個事件通知對方玩家。
- **功能:** 通知對方玩家遊戲中的某個動作。
- **參數:** 待定，根據遊戲邏輯來決定。
- **返回:** 無

### 7.`waiting_for_opponent`
- **觸發時機:** 當玩家正在等待對手加入時，會發送此事件。
- **功能:** 表示玩家正在等待對手加入遊戲。
- **參數:** 待定，根據遊戲邏輯來決定。
- **返回:** 無

## 資料庫結構
### `game`資料表
| 欄位名稱          | 類型        | 說明 |          
| :--              | :--        | :-- |          
| `id`             | INTEGER    | PRIMARY KEY |          
| `room_id`        | VARCHAR(50)| 房間唯一識別碼 (UUID) |          
| `player1_id`     | VARCHAR(50)| 玩家1的ID |          
| `player2_id`     | VARCHAR(50)| 玩家2的ID |          
| `player1_board`  | TEXT       | 玩家1的棋盤狀態 (JSON 格式) |
| `player2_board ` | TEXT       | 玩家2的棋盤狀態 (JSON 格式) |
| `ai_field`       | BOOLEAN    | 是否為ai場 |          
| `ai_turn_array`  | TEXT       | ai步數array |          
| `current_turn`   | VARCHAR(50)| 當前輪到哪位玩家 ID |
| `status`         | VARCHAR(20)| 遊戲狀態：waiting, playing, finished |
| `finished`       | VARCHAR(50)| 贏家 ID(遊戲結束時填入)|
| `created_at`     | DATETIME   | 房間創建時間 |
| `last_activity`  | DATETIME   | 最後更新時間 用於檢查掛機 |

```SQL
CREATE TABLE game (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id VARCHAR(50) NOT NULL UNIQUE,        -- 房間 ID，唯一
    player1_id VARCHAR(50),                     -- 玩家 1 的 ID
    player2_id VARCHAR(50),                     -- 玩家 2 的 ID，若為 AI 則填 "ai"
    player1_board TEXT,                         -- 玩家 1 的棋盤狀態（JSON 格式）
    player2_board TEXT,                         -- 玩家 2 或 AI 的棋盤狀態（JSON 格式）
    ai_field BOOLEAN DEFAULT 0,                 -- 是否為 AI 場（0 = 否, 1 = 是）
    ai_turn_array TEXT,                         -- AI 的預設步數（JSON 陣列格式）
    current_turn VARCHAR(50),                   -- 當前輪到哪位玩家 ID
    status VARCHAR(20) DEFAULT 'waiting',       -- 遊戲狀態：waiting, playing, finished
    winner_id VARCHAR(50),                      -- 贏家 ID（遊戲結束時填入）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 建立時間
    last_activity DATETIME                      -- 最後更新時間，用於判斷掛機
);
```