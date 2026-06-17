import random
from .utils import BOARD_SIZE, SHIP_SIZES


def can_place(board, row, col, length, horizontal):
    if horizontal:
        if col + length > BOARD_SIZE:
            return False
        return all(board[row][c] == 0 for c in range(col, col + length))
    else:
        if row + length > BOARD_SIZE:
            return False
        return all(board[r][col] == 0 for r in range(row, row + length))


def _compute_image_id(ship_id, size):
    if size == 3 and ship_id == 2:
        return 2
    return size


def generate_board():
    board = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
    ships = []
    for idx, size in enumerate(SHIP_SIZES):
        placed = False
        while not placed:
            horizontal = random.choice([True, False])
            if horizontal:
                row = random.randint(0, BOARD_SIZE - 1)
                col = random.randint(0, BOARD_SIZE - size)
            else:
                row = random.randint(0, BOARD_SIZE - size)
                col = random.randint(0, BOARD_SIZE - 1)

            if can_place(board, row, col, size, horizontal):
                if horizontal:
                    for c in range(col, col + size):
                        board[row][c] = 1
                else:
                    for r in range(row, row + size):
                        board[r][col] = 1
                ships.append({
                    "id": idx,
                    "size": size,
                    "row": row,
                    "col": col,
                    "orientation": "horizontal" if horizontal else "vertical",
                    "imageId": _compute_image_id(idx, size),
                })
                placed = True
    return {"board": board, "ships": ships}
