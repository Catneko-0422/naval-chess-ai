// src/components/VictoryConfetti.tsx

/**
 * ============================================================
 * Naval Chess 勝利彩帶動畫（React / react-confetti）
 * Naval Chess Victory Confetti Animation (React / react-confetti)
 * ------------------------------------------------------------
 * ZH:
 * - 當遊戲勝利時顯示彩帶動畫
 * - 彩帶覆蓋整個視窗，隨瀏覽器尺寸自動調整
 * - 動畫只播放一次（recycle=false），持續約 10 秒
 *
 * EN:
 * - Shows a confetti animation on game victory
 * - Covers the entire window and resizes with the browser
 * - Animation plays once (recycle=false), lasting ~10 seconds
 *
 * 使用方式 / Usage:
 * ------------------------------------------------------------
 * <VictoryConfetti show={gameStatus === "finished"} />
 *
 * 相依套件 / Dependency:
 * - react-confetti
 * ============================================================
 */

import Confetti from "react-confetti";
import { useEffect, useState } from "react";

export default function VictoryConfetti({ show }: { show: boolean }) {
    // ZH: 儲存視窗大小，提供給 Confetti 計算覆蓋範圍
    // EN: Store window size for Confetti coverage
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        // ZH: 初始設置大小 / EN: Set initial size
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });

        // ZH: 視窗大小變化時更新狀態 / EN: Update on window resize
        const handleResize = () =>
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // ZH: 若不需顯示，直接回傳 null
    // EN: Return null if not shown
    if (!show) return null;

    return (
        <Confetti
            width={windowSize.width}
            height={windowSize.height}
            numberOfPieces={300} // ZH: 彩帶數量 / EN: Number of confetti pieces
            gravity={0.2}       // ZH: 下落重力效果 / EN: Gravity for falling effect
            recycle={false}     // ZH: 僅播放一次 / EN: Play once, no recycle
            tweenDuration={10000} // ZH: 動畫持續時間 10 秒 / EN: Animation duration ~10s
        />
    );
}
