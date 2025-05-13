// src/components/Sidebar.tsx
"use client";

import React, { useState } from "react";
import useGameStore from "../store/gameStore";
import { motion } from "framer-motion";

export default function Sidebar() {
  const {
    gameStatus,
    ships,
    showShips,
    myMatrix,       // 自己的命中/未命中矩陣
    sunkenShips,    // 已經沉掉的艦艇 id
    setPlayerId,
    joinGame,
  } = useGameStore();
  const [input, setInput] = useState("");

  const handlePvP = () => {
    const id = input.trim() || crypto.randomUUID();
    setPlayerId(id);
    joinGame(false);
  };
  const handlePvE = () => {
    const id = input.trim() || crypto.randomUUID();
    setPlayerId(id);
    joinGame(true);
  };

  return (
    <motion.div
      className="w-full md:w-1/3 flex flex-col gap-6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* 控制區：輸入框 + 按鈕 */}
      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        <motion.input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="輸入 Player ID（可留空）"
          className="w-full p-3 rounded bg-gray-700 text-white placeholder-gray-400"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        />
        <motion.button
          onClick={handlePvP}
          disabled={gameStatus !== "waiting"}
          className="w-full py-3 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          與玩家對戰
        </motion.button>
        <motion.button
          onClick={handlePvE}
          disabled={gameStatus !== "waiting"}
          className="w-full py-3 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          與 AI 對戰
        </motion.button>
        <motion.button
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded bg-gray-600 hover:bg-gray-700 text-white"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🔄 重新整理
        </motion.button>
      </motion.div>

      {/* 小棋盤：顯示自己的棋盤＋命中/未命中，並覆蓋所有已沉的船隻 */}
      {gameStatus === "playing" && (
        <div className="w-full aspect-square bg-gray-800 p-[1px] relative">
          {/* 10x10 栅格 */}
          <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[1px]">
            {showShips(ships).map((row, r) =>
              row.map((cell, c) => {
                const hasShip = cell === 1;
                const hitState = myMatrix[r][c]; // 0=未打, 2=命中, 3=未命中
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`relative aspect-square ${
                      hasShip ? "bg-gray-400" : "bg-transparent"
                    }`}
                  >
                    {hitState === 2 && (
                      <img
                        src="/hit.png"
                        alt="hit"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />
                    )}
                    {hitState === 3 && (
                      <img
                        src="/no_hit.png"
                        alt="miss"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 將所有已沉艦艇的完整圖片，絕對定位覆蓋在格子上 */}
          {sunkenShips.map(sid => {
            const ship = ships.find(s => s.id === sid);
            if (!ship) return null;
            const { size, row, col, orientation, imageId } = ship;
            const isSpecial = imageId !== undefined && imageId !== ship.size;
            const imageUrl = isSpecial
              ? `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}-${imageId}.png`
              : `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}.png`;
            // 百分比定位與長寬
            const top = `${row * 10}%`;
            const left = `${col * 10}%`;
            const width = orientation === "horizontal"
              ? `${size * 10}%`
              : `10%`;
            const height = orientation === "horizontal"
              ? `10%`
              : `${size * 10}%`;

            return (
              <img
                key={`sunken-mini-${sid}`}
                src={imageUrl}
                alt={`sunken-${sid}`}
                className="absolute opacity-80 pointer-events-none"
                style={{
                  top,
                  left,
                  width,
                  height,
                }}
              />
            );
          })}
        </div>
      )}

      {/* 版本資訊 */}
      <motion.p
        className="text-sm text-gray-400 mt-auto text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        版本：v1.0
      </motion.p>
    </motion.div>
  );
}
