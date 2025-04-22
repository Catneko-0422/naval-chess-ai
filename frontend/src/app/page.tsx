"use client";

import Board from "../components/Board";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-row items-start justify-center gap-12 p-24">
      <Board who="player"/>
      <Board who="opponent"/>
    </main>
  );
}
