import random

BOARD_SIZE = 10
SHIP_SIZES = [2, 3, 3, 4, 5]

def can_place(board, row, col, length, horizontal):
    if horizontal:
        if col + length > BOARD_SIZE:
            return False
        return all(board[row][c] == 0 for c in range(col, col + length))
    else:
        if row + length > BOARD_SIZE:
            return False
        return all(board[r][col] == 0 for r in range(row, row + length))


def generate_board():
    """
    生成一個 Battleship 棋盤，並返回格子佈局與船艦清單
    返回值格式:
    {
      "board": [[...],[...],...],
      "ships": [
        {"id":0, "size":2, "row":5, "col":9, "orientation":"horizontal"},
        ...
      ]
    }
    """
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
                # 放置船艦
                if horizontal:
                    for c in range(col, col + size):
                        board[row][c] = 1
                else:
                    for r in range(row, row + size):
                        board[r][col] = 1
                # 記錄船艦資訊
                ships.append({
                    "id": idx,
                    "size": size,
                    "row": row,
                    "col": col,
                    "orientation": "horizontal" if horizontal else "vertical"
                })
                placed = True
    return {"board": board, "ships": ships}