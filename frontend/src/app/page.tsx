"use client";

/**
 * ============================================================
 * Naval Chess 主頁面 (React / Next.js / Framer Motion)
 * Naval Chess Home Page (React / Next.js / Framer Motion)
 * ------------------------------------------------------------
 * ZH:
 * - 管理整個遊戲的頁面布局：棋盤、側邊欄、狀態面板
 * - 負責勝利/失敗後的特效展示（Confetti + 動畫文字）
 *
 * EN:
 * - Handles full game layout: board, sidebar, and status panel
 * - Displays victory/defeat effects (Confetti + animated text)
 *
 * 使用方式 / Usage:
 * ------------------------------------------------------------
 * 作為 Next.js app/page.tsx 預設匯出使用
 * Use as the default export for Next.js app/page.tsx
 *
 * 相依元件 / Dependencies:
 * - Board.tsx, Sidebar.tsx, StatusPanel.tsx, VictoryConfetti.tsx
 * - Zustand store: useGameStore()
 * - framer-motion: motion, AnimatePresence
 * ============================================================
 */

import Board from "@/components/Board";
import Sidebar from "@/components/Sidebar";
import StatusPanel from "@/components/StatusPanel";
import VictoryConfetti from "@/components/VictoryConfetti";
import useGameStore from "@/store/gameStore";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { gameStatus, playerId, currentTurn, opponent_sunkenShips, sunkenShips } =
    useGameStore();

  // ZH: 判斷勝利條件：遊戲結束 + 對手全滅 + 輪到我方
  // EN: Victory condition: game finished + opponent sunk all + my turn
  const isVictory =
    gameStatus === "finished" &&
    opponent_sunkenShips.length === 5 &&
    currentTurn === playerId;

  // ZH: 判斷失敗條件：遊戲結束 + 我方全滅 + 非我方回合
  // EN: Defeat condition: game finished + my ships sunk + not my turn
  const isLost =
    gameStatus === "finished" &&
    sunkenShips.length === 5 &&
    currentTurn !== playerId;

  // ZH: 頁面轉場動畫配置
  // EN: Page animation variants
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
      {/* ======================================================
          勝利/失敗畫面 Overlay + 動畫特效
          Victory/Defeat Overlay + Animation
         ====================================================== */}
      <AnimatePresence>
        {(isVictory || isLost) && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-center items-center pointer-events-none"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [0.7, 1.2, 1], opacity: [0, 1] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.8,
              type: "keyframes", // 必須是 keyframes / must be keyframes
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

      {/* ======================================================
          主內容區 Main content
         ====================================================== */}
      <motion.main
        className="w-full max-w-screen-xl mx-auto px-6 py-8 flex flex-col"
        initial="hidden"
        animate="visible"
        variants={pageVariants}
      >
        {/* ZH: 預留 confetti 元件（非勝利時隱藏）
            EN: Keep confetti mounted (hidden when not victorious) */}
        {!isVictory && <VictoryConfetti show={false} />}

        {/* 標題 / Title */}
        <motion.h1
          className="text-4xl font-extrabold text-center text-white mb-8"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.5 } },
          }}
        >
          DQN海軍棋 / DQN Naval Chess
        </motion.h1>

        {/* 棋盤 + 側邊欄 / Board + Sidebar */}
        <div className="flex flex-col md:flex-row gap-8">
          <Board who={gameStatus === "waiting" ? "player" : "opponent"} />
          <Sidebar />
        </div>

        {/* 狀態面板 / Status Panel */}
        <StatusPanel />
      </motion.main>
    </>
  );
}
