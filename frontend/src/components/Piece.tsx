"use client";

import React from "react";
import { Ship } from "../store/gameStore";

interface PieceProps {
  ship: Ship;
  gridSize: number;
  draggable: boolean;
  onRotate: () => void;
}

const Piece: React.FC<PieceProps> = ({ ship, gridSize, draggable, onRotate }) => {
  // 判断特殊 size=3 第二艘用不同 imageId
  const isSpecial = ship.imageId !== undefined && ship.imageId !== ship.size;
  const imageUrl = isSpecial
    ? `/ships/ship-${ship.size}-${ship.orientation === "horizontal" ? "h" : "v"}-${ship.imageId}.png`
    : `/ships/ship-${ship.size}-${ship.orientation === "horizontal" ? "h" : "v"}.png`;

  const w = ship.orientation === "horizontal" ? ship.size * gridSize : gridSize;
  const h = ship.orientation === "horizontal" ? gridSize : ship.size * gridSize;

  return (
    <div
      className="absolute"
      style={{
        top: ship.row * gridSize,
        left: ship.col * gridSize,
        width: w,
        height: h,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        cursor: draggable ? "pointer" : "default",
        zIndex: 10,
      }}
      draggable={draggable}
      onDragStart={(e) => {
        if (draggable) e.dataTransfer.setData("shipId", ship.id.toString());
        else e.preventDefault();
      }}
      onClick={() => {
        if (draggable) onRotate();
      }}
    />
  );
};

export default Piece;
