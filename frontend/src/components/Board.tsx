"use client";

import React, { useEffect } from "react";
import Piece from "./Piece";
import useGameStore from "../store/gameStore";

const Board: React.FC = () => {
  const boardSize = 10;
  const gridSize = 40; // 每個格子的大小 (像素)
  const { ships, moveShip, rotateShip, initializeShips, showShips } =
    useGameStore();

  useEffect(() => {
    initializeShips();
  }, [initializeShips]);

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const shipId = e.dataTransfer.getData("shipId");
    moveShip(parseInt(shipId, 10), row, col);
  };

  const showSp = () => {
    console.log(showShips(ships));
  };

  return (
    <div className="flex flex-col items-center">
      {/* 棋盤容器 */}
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
          <Piece
            key={ship.id}
            ship={ship}
            onRotate={() => rotateShip(ship.id)}
          />
        ))}
      </div>

      {/* 按鈕移到棋盤外 */}
      <button
        onClick={showSp}
        className="mt-4 p-2 bg-blue-500 text-white rounded"
      >
        Show Ships
      </button>
    </div>
  );
};

export default Board;
