import numpy as np

BOARD_SIZE = 10
SHIP_SIZES = [2, 3, 3, 4, 5]


def check_sunken_ships(board_data):
    board = board_data["board"]
    sunken_ids = []
    for ship in board_data["ships"]:
        size = ship["size"]
        row, col = ship["row"], ship["col"]
        orientation = ship["orientation"]

        if orientation == "horizontal":
            cells = [(row, col + i) for i in range(size)]
        else:
            cells = [(row + i, col) for i in range(size)]

        if all(board[r][c] == 2 for r, c in cells):
            sunken_ids.append(ship["id"])
    return sunken_ids


def get_between_actions(env):
    between_moves = []
    for i in range(BOARD_SIZE):
        for j in range(BOARD_SIZE):
            if env.state[i][j] == 0:
                if j - 1 >= 0 and j + 1 < BOARD_SIZE:
                    if env.state[i][j-1] == 2 and env.state[i][j+1] == 2:
                        between_moves.append(i * BOARD_SIZE + j)
                        continue
                if i - 1 >= 0 and i + 1 < BOARD_SIZE:
                    if env.state[i-1][j] == 2 and env.state[i+1][j] == 2:
                        between_moves.append(i * BOARD_SIZE + j)
    return list(set(between_moves))


def get_all_adjacent_actions(env):
    moves = set()
    for i in range(BOARD_SIZE):
        for j in range(BOARD_SIZE):
            if env.state[i][j] == 2:
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ni, nj = i + dx, j + dy
                    if 0 <= ni < BOARD_SIZE and 0 <= nj < BOARD_SIZE:
                        if env.state[ni][nj] == 0:
                            moves.add(ni * BOARD_SIZE + nj)
    return list(moves)


def is_near_missed_cluster(env, action):
    row, col = divmod(action, BOARD_SIZE)
    count = 0
    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
        nx, ny = row + dx, col + dy
        if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
            if env.state[nx][ny] == 1:
                count += 1
    return count >= 2


def get_probability_actions(env):
    density = env.compute_probability_density()
    available = env.available_actions()
    best = -1
    candidates = []
    for a in available:
        i, j = divmod(a, BOARD_SIZE)
        if density[i, j] > best:
            best = density[i, j]
            candidates = [a]
        elif density[i, j] == best:
            candidates.append(a)
    return candidates


def get_diagonal_actions(env):
    candidates = []
    for a in env.available_actions():
        row, col = divmod(a, BOARD_SIZE)
        if (row % 2 == 0 and col % 2 == 0) or (row % 2 == 1 and col % 2 == 1):
            candidates.append(a)
    if not candidates:
        candidates = env.available_actions()
    return candidates


def get_allowed_actions(env):
    between = get_between_actions(env)
    if between:
        candidates = between
    else:
        adjacent = get_all_adjacent_actions(env)
        if adjacent:
            candidates = adjacent
        else:
            prob_candidates = get_probability_actions(env)
            if prob_candidates:
                candidates = prob_candidates
            else:
                candidates = get_diagonal_actions(env)
    filtered = [a for a in candidates if not is_near_missed_cluster(env, a)]
    return filtered if filtered else candidates
