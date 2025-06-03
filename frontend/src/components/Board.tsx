// src/components/Board.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import useGameStore, { Ship } from "../store/gameStore";

interface BoardProps {
  who: "player" | "opponent";
}

export default function Board({ who }: BoardProps) {
  const {
    playerId,
    ships,
    opponentSunkenShipsDetail,
    showShips,
    initializeShips,
    connectToServer,
    gameStatus,
    currentTurn,
    moveShip,
    rotateShip,
    makeMove,
    opMatrix,
    myMatrix,
  } = useGameStore();

  const inited = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(0);

  useEffect(() => {
    if (!inited.current) {
      initializeShips();
      connectToServer();
      inited.current = true;
    }
    const updateSize = () => {
      if (containerRef.current) {
        const usable = containerRef.current.clientWidth - 9;
        setGridSize(Math.floor(usable / 10));
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [initializeShips, connectToServer]);

  const isPlayer = who === "player";
  const matrix = showShips(ships);
  const hits = isPlayer ? myMatrix : opMatrix;

  return (
    <div
      ref={containerRef}
      className="w-full max-w-screen-lg overflow-x-auto bg-gray-800 p-[1px] rounded-lg"
    >
      <div
        className="relative"
        style={{ width: gridSize * 10, height: gridSize * 10 }}
      >
        {/* 棋格 */}
        <div className="grid grid-cols-10 grid-rows-10 absolute top-0 left-0">
          {matrix.map((row, r) =>
            row.map((cell, c) => {
              const showShip = isPlayer && cell === 1;
              const hitState = hits[r][c]; // 0=未打, 2=命中, 3=未命中
              const canClick =
                who === "opponent" &&
                gameStatus === "playing" &&
                currentTurn === playerId &&
                hitState === 0;
              return (
                <div
                  key={`${r}-${c}`}
                  className={[
                    "aspect-square border border-gray-600",
                    showShip ? "bg-gray-400" : "bg-gray-700",
                    canClick ? "cursor-pointer" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: gridSize, height: gridSize }}
                  onClick={() => {
                    if (canClick) makeMove(r, c);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    if (isPlayer && gameStatus === "waiting") {
                      const id = e.dataTransfer.getData("shipId");
                      if (id) moveShip(Number(id), r, c);
                    }
                  }}
                >
                  {hitState === 2 && (
                    <img
                      src="/hit.png"
                      alt="hit"
                      className="w-full h-full pointer-events-none"
                    />
                  )}
                  {hitState === 3 && (
                    <img
                      src="/no_hit.png"
                      alt="miss"
                      className="w-full h-full pointer-events-none"
                    />
                  )}
                </div>
              );
            }),
          )}
        </div>

        {/* 排艦階段：拖放與旋轉 */}
        {isPlayer &&
          gameStatus === "waiting" &&
          ships.map((ship: Ship) => {
            const { id, size, row, col, orientation, imageId } = ship;
            const isSpecial = imageId !== size;
            const imageUrl = isSpecial
              ? `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}-2.png`
              : `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}.png`;
            const w = orientation === "horizontal" ? size * gridSize : gridSize;
            const h = orientation === "horizontal" ? gridSize : size * gridSize;
            return (
              <img
                key={id}
                src={imageUrl}
                alt={`ship-${id}`}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("shipId", id.toString())
                }
                onClick={() => rotateShip(id)}
                className="absolute z-10"
                style={{
                  top: row * gridSize,
                  left: col * gridSize,
                  width: w,
                  height: h,
                  cursor: "pointer",
                }}
              />
            );
          })}

        {/* 對手棋盤顯示已擊沉的艦船（詳細） */}
        {!isPlayer &&
          gameStatus === "playing" &&
          opponentSunkenShipsDetail.map((ship) => {
            const { id, size, row, col, orientation, imageId } = ship;
            const isSpecial = imageId !== size;
            const imageUrl = isSpecial
              ? `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}-2.png`
              : `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}.png`;
            const w = orientation === "horizontal" ? size * gridSize : gridSize;
            const h = orientation === "horizontal" ? gridSize : size * gridSize;
            return (
              <img
                key={`sunken-detail-${id}`}
                src={imageUrl}
                alt={`sunken-detail-${id}`}
                className="absolute opacity-80 z-20"
                style={{
                  top: row * gridSize,
                  left: col * gridSize,
                  width: w,
                  height: h,
                }}
              />
            );
          })}
      </div>
    </div>
  );
}
