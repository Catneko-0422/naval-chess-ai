// src/components/VictoryConfetti.tsx
"use client";
import Confetti from "react-confetti";
import { useEffect, useState } from "react";

export default function VictoryConfetti({ show }: { show: boolean }) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  if (!show) return null;
  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      numberOfPieces={300}
      gravity={0.2}
      recycle={false}
      tweenDuration={10000}
    />
  );
}
