"use client";

import Board from "@/components/Board";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">海軍棋遊戲</h1>
        <p className="text-gray-400">拖放船隻到棋盤上，開始你的海戰策略！</p>
      </div>
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
        <Board />
      </div>
    </main>
  );
}
