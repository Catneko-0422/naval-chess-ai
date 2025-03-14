interface PieceProps {
  ship: {
    id: number;
    row: number;
    col: number;
    size: number;
    orientation: "horizontal" | "vertical";
  };
  onRotate: () => void;
}

const Piece: React.FC<PieceProps> = ({ ship, onRotate }) => {
  return (
    <div
      className="absolute bg-sky-500 text-white font-bold flex items-center justify-center cursor-pointer"
      style={{
        width:
          ship.orientation === "horizontal" ? `${ship.size * 40}px` : `40px`,
        height:
          ship.orientation === "horizontal" ? `40px` : `${ship.size * 40}px`,
        top: `${ship.row * 40}px`,
        left: `${ship.col * 40}px`,
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
