"use client";

import Board from "../components/Board";
import Sidebar from "../components/Sidebar";
import StatusPanel from "../components/StatusPanel";
import useGameStore from "../store/gameStore";
import { motion } from "framer-motion";

export default function Home() {
  const { gameStatus } = useGameStore();

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
