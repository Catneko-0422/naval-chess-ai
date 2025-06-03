"use client";

import Board from "../components/Board";
import Sidebar from "../components/Sidebar";
import StatusPanel from "../components/StatusPanel";
import VictoryConfetti from "@/components/VictoryConfetti";
import useGameStore from "../store/gameStore";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { gameStatus, playerId, currentTurn, opponent_sunkenShips, sunkenShips } = useGameStore();
  const isVictory =
    gameStatus === "finished" && opponent_sunkenShips.length === 5 && currentTurn === playerId;
  const isLost =
    gameStatus === "finished" && sunkenShips.length === 5 && currentTurn !== playerId;

  const pageVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { when: "beforeChildren", staggerChildren: 0.1 },
    },
  };

  return (
    <>
      <AnimatePresence>
        {(isVictory || isLost) && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-center items-center pointer-events-none"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [0.7, 1.2, 1], opacity: [0, 1] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.8,
              type: "keyframes", // 這裡必須是 keyframes
              ease: "easeInOut",
            }}
          >
            {isVictory && (
              <>
                <VictoryConfetti show />
                <span className="text-5xl font-black text-yellow-400 drop-shadow-lg animate-bounce">
                  🎉 獲勝！強強強! 🎉
                </span>
              </>
            )}
            {isLost && (
              <span className="text-5xl font-black text-blue-400 drop-shadow-lg animate-bounce">
                💔 你輸惹 好爛喔 💔
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.main
        className="w-full max-w-screen-xl mx-auto px-6 py-8 flex flex-col"
        initial="hidden"
        animate="visible"
        variants={pageVariants}
      >
        {/* 勝利才顯示 confetti */}
        {!isVictory && <VictoryConfetti show={false} />}

        <motion.h1
          className="text-4xl font-extrabold text-center text-white mb-8"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.5 } },
          }}
        >
          DQN海軍棋
        </motion.h1>

        <div className="flex flex-col md:flex-row gap-8">
          <Board who={gameStatus === "waiting" ? "player" : "opponent"} />
          <Sidebar />
        </div>

        <StatusPanel />
      </motion.main>
    </>
  );
}
