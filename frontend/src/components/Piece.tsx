import { Ship } from "../store/gameStore";

interface PieceProps {
  ship: Ship;
  onRotate: () => void;
  gridSize: number;
}

const Piece: React.FC<PieceProps> = ({ ship, onRotate, gridSize }) => {
  return (
    <div
      className="absolute bg-sky-500 text-white font-bold flex items-center justify-center cursor-pointer"
      style={{
        width:
          ship.orientation === "horizontal" ? `${ship.size * gridSize}px` : `${gridSize}px`,
        height:
          ship.orientation === "horizontal" ? `${gridSize}px` : `${ship.size * gridSize}px`,
        top: `${ship.row * gridSize}px`,
        left: `${ship.col * gridSize}px`,
      }}
      draggable
      onClick={onRotate}
      onDragStart={(e) => {
        e.dataTransfer.setData("shipId", ship.id.toString());
      }}
    >
      🚢 {ship.size} 格船
    </div>
  );
};

export default Piece;