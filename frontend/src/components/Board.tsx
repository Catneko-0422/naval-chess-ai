"use client";

import React, { useEffect } from "react";
import Piece from "./Piece";
import useGameStore from "../store/gameStore";
import { Ship } from "../store/gameStore";

const Board: React.FC = () => {
  const boardSize = 10;
  const gridSize = 40; // 每個格子的大小 (像素)
  const {
    ships,
    gameStatus,
    currentTurn,
    initializeShips,
    moveShip,
    rotateShip,
    connectToServer,
    joinGame,
    makeMove
  } = useGameStore();

  useEffect(() => {
    initializeShips();
    connectToServer();
  }, [initializeShips, connectToServer]);

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const shipId = e.dataTransfer.getData("shipId");
    moveShip(parseInt(shipId, 10), row, col);
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameStatus === "playing" && currentTurn === useGameStore.getState().socket?.id) {
      makeMove({ row, col });
    }
  };

  const startAIGame = (difficulty: string) => {
    const socket = useGameStore.getState().socket;
    if (socket) {
      socket.emit("start_ai_game", { difficulty });
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* 遊戲狀態顯示 */}
      <div className="mb-4 text-white">
        {gameStatus === "waiting" && "等待對手加入..."}
        {gameStatus === "playing" && (
          <div>
            {currentTurn === useGameStore.getState().socket?.id
              ? "輪到你了"
              : "等待對手行動"}
          </div>
        )}
        {gameStatus === "finished" && "遊戲結束"}
      </div>

      {/* 棋盤容器 */}
      <div
        className="relative border-2 border-gray-600 rounded-lg p-4 bg-gray-700 shadow-inner"
        style={{ width: boardSize * gridSize, height: boardSize * gridSize }}
      >
        {/* 棋盤格子 */}
        {Array.from({ length: boardSize }, (_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: boardSize }, (_, col) => (
              <div
                key={col}
                className="w-10 h-10 border border-gray-500 absolute hover:bg-gray-600 transition-colors duration-200"
                style={{
                  width: gridSize,
                  height: gridSize,
                  top: row * gridSize,
                  left: col * gridSize,
                }}
                onDragOver={(e: React.DragEvent) => e.preventDefault()}
                onDrop={(e: React.DragEvent) => handleDrop(e, row, col)}
                onClick={() => handleCellClick(row, col)}
              />
            ))}
          </div>
        ))}

        {/* 船隻 */}
        {ships.map((ship: Ship) => (
          <Piece
            key={ship.id}
            ship={ship}
            onRotate={() => rotateShip(ship.id)}
          />
        ))}
      </div>

      {/* 按鈕組 */}
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex gap-4">
          <button
            onClick={joinGame}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors duration-200"
          >
            與其他玩家對戰
          </button>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => startAIGame('easy')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors duration-200"
          >
            與AI對戰 (簡單)
          </button>
          <button
            onClick={() => startAIGame('medium')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors duration-200"
          >
            與AI對戰 (中等)
          </button>
          <button
            onClick={() => startAIGame('hard')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors duration-200"
          >
            與AI對戰 (困難)
          </button>
        </div>
      </div>
    </div>
  );
};

export default Board;
