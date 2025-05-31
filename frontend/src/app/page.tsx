"use client";

import Board from "../components/Board";
import Sidebar from "../components/Sidebar";
import StatusPanel from "../components/StatusPanel";
import VictoryConfetti from "@/components/VictoryConfetti";
import useGameStore from "../store/gameStore";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { gameStatus, playerId, currentTurn, sunkenShips } = useGameStore();
  // 判斷自己是否獲勝
  const isVictory = gameStatus === "finished" && sunkenShips.length === 5 && currentTurn === playerId;

  const pageVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { when: "beforeChildren", staggerChildren: 0.1 } }
  };

  return (
    <motion.main
      className="w-full max-w-screen-xl mx-auto px-6 py-8 flex flex-col"
      initial="hidden"
      animate="visible"
      variants={pageVariants}
    >
      {/* 勝利動畫效果 */}
      <VictoryConfetti show={isVictory} />
      <AnimatePresence>
        {isVictory && (
          <motion.div
            className="fixed left-1/2 top-1/4 -translate-x-1/2 z-50"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [0.7, 1.2, 1], opacity: [0, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
          >
            <span className="text-5xl font-black text-yellow-400 drop-shadow-lg animate-bounce">
              🎉 恭喜你獲勝！🎉
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.h1
        className="text-4xl font-extrabold text-center text-white mb-8"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}
      >
        海戰棋大作戰
      </motion.h1>

      <div className="flex flex-col md:flex-row gap-8">
        <Board who={gameStatus === "waiting" ? "player" : "opponent"} />
        <Sidebar />
      </div>

      <StatusPanel />
    </motion.main>
  );
}
