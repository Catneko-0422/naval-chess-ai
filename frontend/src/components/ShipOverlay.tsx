import { Ship } from "@/store/gameStore";
import { buildShipImageUrl } from "@/utils/board";

interface ShipOverlayProps {
  ship: Ship;
  gridSize?: number;
  percent?: boolean;
}

export default function ShipOverlay({ ship, gridSize, percent }: ShipOverlayProps) {
  const { size, row, col, orientation } = ship;

  if (percent) {
    return (
      <img
        src={buildShipImageUrl(ship)}
        alt={`ship-${ship.id}`}
        className="absolute opacity-80 pointer-events-none"
        style={{
          top: `${row * 10}%`,
          left: `${col * 10}%`,
          width: orientation === "horizontal" ? `${size * 10}%` : "10%",
          height: orientation === "horizontal" ? "10%" : `${size * 10}%`,
        }}
      />
    );
  }

  return (
    <img
      src={buildShipImageUrl(ship)}
      alt={`ship-${ship.id}`}
      className="absolute opacity-80 z-20"
      style={{
        top: row * gridSize!,
        left: col * gridSize!,
        width: orientation === "horizontal" ? size * gridSize! : gridSize!,
        height: orientation === "horizontal" ? gridSize! : size * gridSize!,
      }}
    />
  );
}
