import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import random
from collections import deque
from copy import deepcopy
from battleship_board import generate_board, BOARD_SIZE, SHIP_SIZES

#############################
# Battleship Environment
#############################
# 狀態定義：
# 0：未攻擊
# 1：攻擊後未命中
# 2：命中（但尚未確認是否已沈沒）
# 3：命中且該船已沈沒（僅內部更新，不讓 AI 得知）
#
# CNN 輸入共 4 通道：
# ch0: (state == 0)
# ch1: (state == 1)
# ch2: ((state == 2) or (state == 3)) → 攻擊痕跡
# ch3: 剩餘船艦資訊比例 = (剩餘未命中船艦格數) / (初始船艦總格數)
class BattleshipEnv:
    def __init__(self):
        self.total_ship_segments = sum(SHIP_SIZES)  # 例如 17
        self.reset()

    def reset(self):
        self.ship_board = generate_board()  # 隱藏棋盤，AI 不可見
        # 初始化 state: 全為 0
        self.state = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
        self.remaining = sum(row.count(1) for row in self.ship_board)
        # 初始化剩餘船艦列表（深複製一份）
        self.remaining_ships = deepcopy(SHIP_SIZES)
        self.last_hit_position = None  # 目標模式：記錄最新命中位置
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
            reward = -1  # 重複攻擊的懲罰
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

#############################
# DQN Model
#############################
class DQN(nn.Module):
    def __init__(self):
        super(DQN, self).__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels=4, out_channels=32, kernel_size=3, stride=1, padding=1),
            nn.ReLU(),
            nn.Conv2d(in_channels=32, out_channels=64, kernel_size=3, stride=1, padding=1),
            nn.ReLU()
        )
        self.fc = nn.Sequential(
            nn.Linear(64 * BOARD_SIZE * BOARD_SIZE, 256),
            nn.ReLU(),
            nn.Linear(256, BOARD_SIZE * BOARD_SIZE)
        )

    def forward(self, x):
        x = self.conv(x)
        x = x.view(x.size(0), -1)
        return self.fc(x)

#############################
# Allowed Action 選取策略
#############################
# ① 目標模式：先找出「兩個2中間」的 cell
def get_between_actions(env):
    between_moves = []
    for i in range(BOARD_SIZE):
        for j in range(BOARD_SIZE):
            if env.state[i][j] == 0:
                # 檢查水平方向
                if j - 1 >= 0 and j + 1 < BOARD_SIZE:
                    if env.state[i][j-1] == 2 and env.state[i][j+1] == 2:
                        between_moves.append(i * BOARD_SIZE + j)
                        continue
                # 檢查垂直方向
                if i - 1 >= 0 and i + 1 < BOARD_SIZE:
                    if env.state[i-1][j] == 2 and env.state[i+1][j] == 2:
                        between_moves.append(i * BOARD_SIZE + j)
    return list(set(between_moves))

# ② 目標模式：找出所有命中（2）周圍尚未攻擊的 cell
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

# 避免在連續 1 附近攻擊：檢查鄰近（上下左右）是否有 2 個或以上 1
def is_near_missed_cluster(env, action):
    row, col = divmod(action, BOARD_SIZE)
    count = 0
    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
        nx, ny = row + dx, col + dy
        if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
            if env.state[nx][ny] == 1:
                count += 1
    return count >= 2

# ③ 搜尋模式（Hunt Mode）：利用機率密度法決定候選動作
def get_probability_actions(env):
    density = env.compute_probability_density()
    available = env.available_actions()
    # 只考慮 available 的 cell，挑選 density 最高的 cell
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

# ④ 若上述都沒有候選，再退而求其次採用梅花策略
def get_diagonal_actions(env):
    candidates = []
    for a in env.available_actions():
        row, col = divmod(a, BOARD_SIZE)
        # 斜梅花策略：選擇 row 與 col 同餘的 cell（均為偶數或均為奇數）
        if (row % 2 == 0 and col % 2 == 0) or (row % 2 == 1 and col % 2 == 1):
            candidates.append(a)
    if not candidates:
        candidates = env.available_actions()
    return candidates

# 整合候選動作選取策略：先目標模式，若無則採用機率密度法，再無則採用斜梅花
def get_allowed_actions(env):
    # 優先：兩個2中間的 cell
    between = get_between_actions(env)
    if between:
        candidates = between
    else:
        # 其次：所有命中周邊 cell
        adjacent = get_all_adjacent_actions(env)
        if adjacent:
            candidates = adjacent
        else:
            # 接著：利用機率密度法
            prob_candidates = get_probability_actions(env)
            if prob_candidates:
                candidates = prob_candidates
            else:
                # 最後：斜梅花策略
                candidates = get_diagonal_actions(env)
    # 過濾掉鄰近連續 1 的候選
    filtered = [a for a in candidates if not is_near_missed_cluster(env, a)]
    return filtered if filtered else candidates

#############################
# Training
#############################
def train():
    env = BattleshipEnv()
    model = DQN()
    target_model = DQN()
    target_model.load_state_dict(model.state_dict())

    optimizer = optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.MSELoss()
    memory = deque(maxlen=5000)
    batch_size = 64
    gamma = 0.99
    epsilon = 1.0
    epsilon_decay = 0.995
    epsilon_min = 0.01
    update_target_steps = 20
    episodes = 1000

    for episode in range(episodes):
        state_np = env.reset()  # (4,10,10)
        state = torch.FloatTensor(state_np).unsqueeze(0)  # (1,4,10,10)
        total_reward = 0

        for t in range(100):
            allowed_moves = get_allowed_actions(env)
            if random.random() < epsilon:
                action = random.choice(allowed_moves)
            else:
                with torch.no_grad():
                    q_values = model(state).squeeze()  # (100,)
                    for i in range(BOARD_SIZE * BOARD_SIZE):
                        if i not in allowed_moves:
                            q_values[i] = -1e9
                    action = torch.argmax(q_values).item()

            next_state_np, reward, done = env.step(action)
            next_state = torch.FloatTensor(next_state_np).unsqueeze(0)
            memory.append((state, action, reward, next_state, done))
            state = next_state
            total_reward += reward

            if done:
                break

        if len(memory) >= batch_size:
            batch = random.sample(memory, batch_size)
            state_b, action_b, reward_b, next_state_b, done_b = zip(*batch)
            state_b = torch.cat(state_b)
            next_state_b = torch.cat(next_state_b)
            action_b = torch.LongTensor(action_b).unsqueeze(1)
            reward_b = torch.FloatTensor(reward_b).unsqueeze(1)
            done_b = torch.FloatTensor(done_b).unsqueeze(1)

            q_values = model(state_b).gather(1, action_b)
            with torch.no_grad():
                next_q = target_model(next_state_b).max(1, keepdim=True)[0]
                q_target = reward_b + (1 - done_b) * gamma * next_q

            loss = loss_fn(q_values, q_target)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        if episode % update_target_steps == 0:
            target_model.load_state_dict(model.state_dict())
        if epsilon > epsilon_min:
            epsilon *= epsilon_decay

        print(f"Episode {episode+1}, Total Reward: {total_reward:.2f}, Epsilon: {epsilon:.3f}")

    torch.save(model.state_dict(), "dqn_battleship.pth")
    print("訓練完成並儲存模型")

if __name__ == "__main__":
    train()
