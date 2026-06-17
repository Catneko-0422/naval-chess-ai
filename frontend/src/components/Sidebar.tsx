import React, { useState } from "react";
import useGameStore from "../store/gameStore";
import ShipOverlay from "./ShipOverlay";
import { motion } from "framer-motion";

export default function Sidebar() {
  const {
    gameStatus,
    ships,
    showShips,
    myMatrix,
    sunkenShips,
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
      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        <motion.input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入 Player ID（可留空） / Enter Player ID (optional)"
          className="w-full p-3 rounded bg-gray-700 text-white placeholder-gray-400"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        />

        <motion.button
          onClick={handlePvP}
          disabled={gameStatus !== "waiting"}
          className="w-full py-3 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-disabled={gameStatus !== "waiting"}
        >
          與玩家對戰 / Play vs Player
        </motion.button>

        <motion.button
          onClick={handlePvE}
          disabled={gameStatus !== "waiting"}
          className="w-full py-3 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-disabled={gameStatus !== "waiting"}
        >
          與 AI 對戰 / Play vs AI
        </motion.button>

        <motion.button
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded bg-gray-600 hover:bg-gray-700 text-white"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🔄 重新整理 / Refresh
        </motion.button>
      </motion.div>

      {gameStatus === "playing" && (
        <div className="w-full aspect-square bg-gray-800 p-[1px] relative rounded">
          <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[1px]">
            {showShips(ships).map((row, r) =>
              row.map((cell, c) => {
                const hitState = myMatrix[r][c];
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`relative aspect-square ${cell === 1 ? "bg-gray-400" : "bg-transparent"}`}
                  >
                    {hitState === 2 && (
                      <img
                        src="/images/hits_images/hit.png"
                        alt="hit"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />
                    )}
                    {hitState === 3 && (
                      <img
                        src="/images/hits_images/no_hit.png"
                        alt="miss"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {sunkenShips.map((sid) => {
            const ship = ships.find((s) => s.id === sid);
            if (!ship) return null;
            return <ShipOverlay key={`sunken-mini-${sid}`} ship={ship} percent />;
          })}
        </div>
      )}

      <motion.p
        className="text-sm text-gray-400 mt-auto text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        版本：v1.0 / Version: v1.0
      </motion.p>
    </motion.div>
  );
}
