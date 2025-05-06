// src/components/Board.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import useGameStore, { Ship } from "../store/gameStore";
import Piece from "./Piece";

interface BoardProps {
  who: "player" | "opponent";
}

const Board: React.FC<BoardProps> = ({ who }) => {
  const boardSize = 10;
  const isPlayer = who === "player";

  // 动态格子大小：自己最大 800px 宽度，否则固定 30px
  const [gridSize, setGridSize] = useState(30);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPlayer) {
      const size = Math.min(window.innerWidth * 0.6, 800) / boardSize;
      setGridSize(size);
    } else {
      setGridSize(30);
    }
  }, [isPlayer]);

  const {
    ships,
    showShips,
    initializeShips,
    connectToServer,
    gameStatus,
    currentTurn,
    socket,
    moveShip,
    rotateShip,
    makeMove,
  } = useGameStore();

  // 自己或对手的击中/未中矩阵，只在对手棋盘展示
  const [opMatrix, setOpMatrix] = useState<number[][]>(
    Array.from({ length: boardSize }, () => Array(boardSize).fill(0))
  );

  // 一次性初始化
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    initializeShips();
    connectToServer();

    // 监听 move_made 事件，更新对手矩阵
    socket?.on("move_made", ({ attacker, x, y, hit }) => {
      if (attacker === socket.id) {
        setOpMatrix((prev) => {
          const next = prev.map((row) => row.slice());
          next[x][y] = hit ? 2 : 3;
          return next;
        });
      }
    });

    inited.current = true;
  }, [initializeShips, connectToServer, socket]);

  // 拖放布船
  const handleDrop = (e: React.DragEvent, r: number, c: number) => {
    if (gameStatus !== "waiting" || !isPlayer) return;
    e.preventDefault();
    const id = e.dataTransfer.getData("shipId");
    if (id) moveShip(Number(id), r, c);
  };

  // 点击对手格子
  const handleCellClick = (r: number, c: number) => {
    if (
      !isPlayer &&
      gameStatus === "playing" &&
      currentTurn === socket?.id &&
      opMatrix[r][c] === 0
    ) {
      makeMove(r, c);
    }
  };

  // 矩阵：自己的布船 or 对手已击状态
  const myMatrix = showShips(ships);

  return (
    <div
      className="relative border-2 border-gray-600 rounded-lg p-2 bg-gray-700 shadow-inner"
      style={{
        width: boardSize * gridSize,
        height: boardSize * gridSize,
      }}
    >
      {/* 棋格 */}
      {Array.from({ length: boardSize }).map((_, r) =>
        Array.from({ length: boardSize }).map((_, c) => {
          const baseStyle: React.CSSProperties = {
            position: "absolute",
            top: r * gridSize,
            left: c * gridSize,
            width: gridSize,
            height: gridSize,
            boxSizing: "border-box",
            border: "1px solid #444",
            backgroundColor: isPlayer
              ? myMatrix[r][c] === 1
                ? "rgba(200,200,200,0.4)"
                : "#222"
              : "#222",
            cursor:
              !isPlayer &&
              gameStatus === "playing" &&
              currentTurn === socket?.id &&
              opMatrix[r][c] === 0
                ? "pointer"
                : "default",
          };
          return (
            <div
              key={`${r}-${c}`}
              style={baseStyle}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, r, c)}
              onClick={() => handleCellClick(r, c)}
            >
              {/* 命中/未命中标记 */}
              {!isPlayer && opMatrix[r][c] === 2 && (
                <img
                  src="/hit.png"
                  alt="hit"
                  style={{
                    width: gridSize,
                    height: gridSize,
                    pointerEvents: "none",
                  }}
                />
              )}
              {!isPlayer && opMatrix[r][c] === 3 && (
                <img
                  src="/no_hit.png"
                  alt="miss"
                  style={{
                    width: gridSize,
                    height: gridSize,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          );
        })
      )}

      {/* 只在 waiting 且 自己棋盘 时显示、可拖拽/旋转的船 */}
      {isPlayer &&
        gameStatus === "waiting" &&
        ships.map((ship: Ship) => (
          <Piece
            key={ship.id}
            ship={ship}
            gridSize={gridSize}
            draggable={true}
            onRotate={() => rotateShip(ship.id)}
          />
        ))}
    </div>
  );
};

export default Board;
