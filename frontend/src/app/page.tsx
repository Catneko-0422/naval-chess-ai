"use client";

import Board from "@/components/Board";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
      <h1>海軍棋遊戲</h1>
      <Board />
    </main>
  );
}
