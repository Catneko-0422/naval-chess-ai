import numpy as np
from copy import deepcopy
from battleship_board import BOARD_SIZE, SHIP_SIZES

class BattleshipEnv:
    def __init__(self, board):
        self.total_ship_segments = sum(SHIP_SIZES)  # 例如 17
        self.ship_board = board
        self.reset()

    def reset(self):
        # 初始化 state: 全為 0
        self.state = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
        self.remaining = sum(row.count(1) for row in self.ship_board)
        # 初始化剩餘船艦列表（深複製一份）
        self.remaining_ships = deepcopy(SHIP_SIZES)
        self.last_hit_position = None  # 目標模式：記錄最新命中位置（這邊已無用）
        return self.get_feature_map()

    def get_feature_map(self):
        board = np.array(self.state)
        ch0 = (board == 0).astype(np.float32)
        ch1 = (board == 1).astype(np.float32)
        # 將 2 與 3 均視作命中痕跡
        ch2 = ((board == 2) | (board == 3)).astype(np.float32)
        remaining_ratio = self.remaining / self.total_ship_segments
        ch3 = np.full((BOARD_SIZE, BOARD_SIZE), remaining_ratio, dtype=np.float32)
        feature_map = np.stack([ch0, ch1, ch2, ch3], axis=0)
        return feature_map

    def step(self, action):
        x, y = divmod(action, BOARD_SIZE)
        reward = 0
        done = False

        if self.state[x][y] != 0:
            reward = 1  # 重複攻擊的懲罰
        elif self.ship_board[x][y] == 1:
            self.state[x][y] = 2  # 命中
            reward = 1
            self.last_hit_position = (x, y)
            reward += 0.5  # 連續命中獎勵
            self.remaining -= 1
        else:
            self.state[x][y] = 1  # 未命中
            reward = -0.1
            self.last_hit_position = None

        # 檢查是否有船艦完全被命中
        self.check_and_mark_sunk()

        if self.remaining == 0:
            done = True
            reward = 10

        return self.get_feature_map(), reward, done

    def available_actions(self):
        # 提供合法未攻擊動作，主要用於環境評估，但在學習時不再使用此過濾策略
        return [i for i in range(BOARD_SIZE * BOARD_SIZE)
                if self.state[i // BOARD_SIZE][i % BOARD_SIZE] == 0]

    def check_and_mark_sunk(self):
        """
        利用隱藏棋盤，對每艘船（上下左右連通的 1 組）檢查在 state 中是否全部被命中（2）。
        若是，則將該區塊的 state 由 2 變 3，並從 remaining_ships 刪除一個相同尺寸的船艦。
        """
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
                    # 判斷該艘船在 state 中是否全為 2
                    sunk = all(self.state[x][y] == 2 for (x, y) in ship_cells)
                    if sunk:
                        for (x, y) in ship_cells:
                            self.state[x][y] = 3
                        # 從 remaining_ships 移除一艘相同尺寸的船（若存在）
                        ship_size = len(ship_cells)
                        if ship_size in self.remaining_ships:
                            self.remaining_ships.remove(ship_size)
                        # 若 last_hit_position 屬於此艘船，則清空
                        if self.last_hit_position in ship_cells:
                            self.last_hit_position = None
    
    def compute_probability_density(self):
        """
        計算機率密度：對於每個 cell，檢查剩餘的每一艘船從該 cell 能否合法放置（水平、垂直）
        考慮條件：不得覆蓋 state 中已被攻擊（state != 0）的格子。
        回傳 shape = (BOARD_SIZE, BOARD_SIZE) 的陣列，數值越高代表該 cell 更可能藏有船艦。
        """
        density = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.float32)
        available = np.array(self.state) == 0
        for ship_len in self.remaining_ships:
            # 水平放置
            for i in range(BOARD_SIZE):
                for j in range(BOARD_SIZE - ship_len + 1):
                    segment = available[i, j:j+ship_len]
                    if segment.all():
                        for k in range(ship_len):
                            density[i, j+k] += 1
            # 垂直放置
            for j in range(BOARD_SIZE):
                for i in range(BOARD_SIZE - ship_len + 1):
                    segment = available[i:i+ship_len, j]
                    if segment.all():
                        for k in range(ship_len):
                            density[i+k, j] += 1
        return density