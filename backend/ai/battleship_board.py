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

def place_ship(board, length):
    placed = False
    while not placed:
        horizontal = random.choice([True, False])
        if horizontal:
            row = random.randint(0, BOARD_SIZE - 1)
            col = random.randint(0, BOARD_SIZE - length)
        else:
            row = random.randint(0, BOARD_SIZE - length)
            col = random.randint(0, BOARD_SIZE - 1)

        if can_place(board, row, col, length, horizontal):
            if horizontal:
                for c in range(col, col + length):
                    board[row][c] = 1
            else:
                for r in range(row, row + length):
                    board[r][col] = 1
            placed = True

def generate_board():
    board = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
    for size in SHIP_SIZES:
        place_ship(board, size)
    return board
