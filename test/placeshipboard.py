# place_ship_board.py

BOARD_SIZE = 10

# 船艦資料：id -> 長度
SHIP_INFO = {
    1: 2,
    2: 3,
    3: 3,
    4: 4,
    5: 5
}

def create_empty_board():
    return [[0 for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]

def place_single_ship(board, x, y, ship_id, direction):
    """
    x, y: 左上角座標
    ship_id: 船艦編號 (對應長度)
    direction: "H" 或 "V"（水平或垂直）
    """
    length = SHIP_INFO.get(ship_id)
    if not length:
        raise ValueError(f"無效的船艦 ID: {ship_id} 喵")

    if direction == "H":
        if y + length > BOARD_SIZE:
            raise ValueError("船太長，超出棋盤邊界喵")
        for i in range(length):
            if board[x][y + i] != 0:
                raise ValueError("船艦位置重疊喵")
        for i in range(length):
            board[x][y + i] = ship_id
    elif direction == "V":
        if x + length > BOARD_SIZE:
            raise ValueError("船太長，超出棋盤邊界喵")
        for i in range(length):
            if board[x + i][y] != 0:
                raise ValueError("船艦位置重疊喵")
        for i in range(length):
            board[x + i][y] = ship_id
    else:
        raise ValueError("方向必須是 'H' 或 'V' 喵")

    return board
