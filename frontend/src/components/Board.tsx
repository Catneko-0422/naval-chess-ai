"use client";

import React, { useEffect } from "react";
import Piece from "./Piece";
import useGameStore from "../store/gameStore";

const Board: React.FC = () => {
  const boardSize = 10;
  const gridSize = 40; // 每個格子的大小 (像素)
  const { ships, moveShip, rotateShip, initializeShips } = useGameStore();

  useEffect(() => {
    initializeShips();
  }, [initializeShips]);

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const shipId = e.dataTransfer.getData("shipId");
    moveShip(parseInt(shipId, 10), row, col);
  };

  return (
    <div
      className="relative border-2 p-4"
      style={{ width: boardSize * gridSize, height: boardSize * gridSize }}
    >
      {/* 棋盤格子 */}
      {Array.from({ length: boardSize }, (_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: boardSize }, (_, col) => (
            <div
              key={col}
              className="w-10 h-10 border absolute"
              style={{
                width: gridSize,
                height: gridSize,
                top: row * gridSize,
                left: col * gridSize,
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, row, col)}
            />
          ))}
        </div>
      ))}

      {/* 船隻 */}
      {ships.map((ship) => (
        <Piece key={ship.id} ship={ship} onRotate={() => rotateShip(ship.id)} />
      ))}
    </div>
  );
};

export default Board;
