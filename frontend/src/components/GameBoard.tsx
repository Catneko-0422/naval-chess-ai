import React, { useEffect } from "react";
import useGameStore from "../store/gameStore";

interface CellProps {
  row: number;
  col: number;
  hasShip: boolean;
  onClick: (row: number, col: number) => void;
}

const Cell: React.FC<CellProps> = ({ row, col, hasShip, onClick }) => (
  <div
    className={`board-cell ${hasShip ? "ship" : ""}`}
    onClick={() => onClick(row, col)}
  />
);

const GameBoard: React.FC = () => {
  const {
    ships,
    gameStatus,
    currentTurn,
    isLocalMultiplayer,
    localPlayerId,
    initializeShips,
    showShips,
    connectToServer,
    joinGame,
    makeMove,
    startLocalMultiplayer,
    makeLocalMove
  } = useGameStore();

  useEffect(() => {
    initializeShips();
  }, [initializeShips]);

  const handleCellClick = (row: number, col: number) => {
    if (gameStatus === "playing") {
      if (isLocalMultiplayer) {
        makeLocalMove({ row, col });
      } else {
        makeMove({ row, col });
      }
    }
  };

  const handleStartGame = () => {
    if (isLocalMultiplayer) {
      startLocalMultiplayer();
    } else {
      connectToServer();
      joinGame();
    }
  };

  return (
    <div className="game-board">
      <div className="board-grid">
        {showShips(ships).map((row: number[], rowIndex: number) => (
          <div key={rowIndex} className="board-row">
            {row.map((cell: number, colIndex: number) => (
              <Cell
                key={`${rowIndex}-${colIndex}`}
                row={rowIndex}
                col={colIndex}
                hasShip={cell === 1}
                onClick={handleCellClick}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="game-controls">
        <button onClick={handleStartGame}>
          {isLocalMultiplayer ? "開始本地對戰" : "開始在線對戰"}
        </button>
        <button onClick={() => initializeShips()}>重新排列船隻</button>
      </div>
      <div className="game-status">
        {gameStatus === "waiting" && "等待對手..."}
        {gameStatus === "playing" && (
          <div>
            {isLocalMultiplayer
              ? `當前回合: ${currentTurn === localPlayerId ? "玩家1" : "玩家2"}`
              : `當前回合: ${currentTurn === "player1" ? "玩家1" : "玩家2"}`}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard; 