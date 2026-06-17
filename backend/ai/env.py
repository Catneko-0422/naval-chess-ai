import numpy as np
from copy import deepcopy
from .utils import BOARD_SIZE, SHIP_SIZES
from .battleship_board import generate_board


class BattleshipEnv:
    def __init__(self, board=None):
        self.total_ship_segments = sum(SHIP_SIZES)
        self.ship_board = board if board is not None else generate_board()['board']
        self.reset()

    def reset(self):
        self.state = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
        self.remaining = sum(row.count(1) for row in self.ship_board)
        self.remaining_ships = deepcopy(SHIP_SIZES)
        self.last_hit_position = None
        return self.get_feature_map()

    def get_feature_map(self):
        board = np.array(self.state)
        ch0 = (board == 0).astype(np.float32)
        ch1 = (board == 1).astype(np.float32)
        ch2 = ((board == 2) | (board == 3)).astype(np.float32)
        remaining_ratio = self.remaining / self.total_ship_segments
        ch3 = np.full((BOARD_SIZE, BOARD_SIZE), remaining_ratio, dtype=np.float32)
        return np.stack([ch0, ch1, ch2, ch3], axis=0)

    def step(self, action):
        x, y = divmod(action, BOARD_SIZE)
        reward = 0
        done = False

        if self.state[x][y] != 0:
            reward = -1
        elif self.ship_board[x][y] == 1:
            self.state[x][y] = 2
            reward = 1
            self.last_hit_position = (x, y)
            reward += 0.5
            self.remaining -= 1
        else:
            self.state[x][y] = 1
            reward = -0.1
            self.last_hit_position = None

        self.check_and_mark_sunk()

        if self.remaining == 0:
            done = True
            reward = 10

        return self.get_feature_map(), reward, done

    def available_actions(self):
        return [i for i in range(BOARD_SIZE * BOARD_SIZE)
                if self.state[i // BOARD_SIZE][i % BOARD_SIZE] == 0]

    def check_and_mark_sunk(self):
        visited = [[False] * BOARD_SIZE for _ in range(BOARD_SIZE)]
        for i in range(BOARD_SIZE):
            for j in range(BOARD_SIZE):
                if self.ship_board[i][j] == 1 and not visited[i][j]:
                    ship_cells = []
                    stack = [(i, j)]
                    visited[i][j] = True
                    while stack:
                        cx, cy = stack.pop()
                        ship_cells.append((cx, cy))
                        for dx, dy in [(1,0), (-1,0), (0,1), (0,-1)]:
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
                                if self.ship_board[nx][ny] == 1 and not visited[nx][ny]:
                                    visited[nx][ny] = True
                                    stack.append((nx, ny))
                    sunk = all(self.state[x][y] == 2 for (x, y) in ship_cells)
                    if sunk:
                        for (x, y) in ship_cells:
                            self.state[x][y] = 3
                        ship_size = len(ship_cells)
                        if ship_size in self.remaining_ships:
                            self.remaining_ships.remove(ship_size)
                        if self.last_hit_position in ship_cells:
                            self.last_hit_position = None

    def compute_probability_density(self):
        density = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.float32)
        available = np.array(self.state) == 0
        for ship_len in self.remaining_ships:
            for i in range(BOARD_SIZE):
                for j in range(BOARD_SIZE - ship_len + 1):
                    segment = available[i, j:j+ship_len]
                    if segment.all():
                        for k in range(ship_len):
                            density[i, j+k] += 1
            for j in range(BOARD_SIZE):
                for i in range(BOARD_SIZE - ship_len + 1):
                    segment = available[i:i+ship_len, j]
                    if segment.all():
                        for k in range(ship_len):
                            density[i+k, j] += 1
        return density
