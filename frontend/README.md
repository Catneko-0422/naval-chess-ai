# ⚓️ DQN Naval Chess (frontend)

一款基於 **Next.js + Zustand + Flask-SocketIO + DQN AI** 的網頁版海軍棋 (Battleship) 遊戲。 
支援 **玩家對玩家 (PvP)** 與 **玩家對 AI (PvE)**，並提供即時對戰、船艦佈局、命中提示、沉艦顯示與勝利動畫。

---

## 📂 專案結構 (重點)

```bash
.
├── public/                     # 靜態資源 (images, ships, hit/miss icons)
├── src/
│   ├── components/             # React UI 元件
│   │   ├── Board.tsx           # 棋盤 (拖放、點擊攻擊)
│   │   ├── Sidebar.tsx         # 側邊欄 (控制區 + 縮略棋盤)
│   │   ├── StatusPanel.tsx     # 狀態面板 (回合、攻擊、沉艦資訊)
│   │   └── VictoryConfetti.tsx # 勝利彩帶動畫
│   ├── store/
│   │   └── gameStore.ts        # Zustand 遊戲狀態管理 (Socket.IO + API 整合)
│   └── app/page.tsx            # 主頁面入口
├── next.config.js
├── package.json
└── Dockerfile
```

## 🚀 安裝與執行

### 1. 本地開發
```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```
- 預設開在 `http://localhost:3000`
- 需搭配後端 Flask-SocketIO API，預設連線 `http://localhost:5000`

### 2. Docker 建置
```bash
# 建置映像
docker build -t dqn-naval-chess-frontend .

# 執行容器
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL={your_backend_url} \
  dqn-naval-chess-frontend
```