import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import random
import matplotlib.pyplot as plt
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
# Training
#############################
def train():
    reward_history = []
    epsilon_history = []

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
    update_target_steps = 10
    episodes = 1000

    for episode in range(episodes):
        state_np = env.reset()  # (4, BOARD_SIZE, BOARD_SIZE)
        state = torch.FloatTensor(state_np).unsqueeze(0)  # (1,4,BOARD_SIZE,BOARD_SIZE)
        total_reward = 0  # 重新設定初始回合獎勵

        for t in range(100):
            # 探索階段：直接從全部 100 個位置中選擇
            if random.random() < epsilon:
                action = random.randint(0, BOARD_SIZE * BOARD_SIZE - 1)
            else:
                with torch.no_grad():
                    q_values = model(state).squeeze()  # (BOARD_SIZE*BOARD_SIZE,)
                    action = torch.argmax(q_values).item()

            next_state_np, reward, done = env.step(action)
            next_state = torch.FloatTensor(next_state_np).unsqueeze(0)
            memory.append((state, action, reward, next_state, done))
            state = next_state
            total_reward += reward

            if done:
                break

        # 在記憶庫達到一定量後，進行 mini-batch 訓練
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
                # 採用 Double DQN 策略：由 model 選擇最佳動作，由 target_model 評估該動作
                next_actions = model(next_state_b).argmax(1, keepdim=True)
                next_q = target_model(next_state_b).gather(1, next_actions)
                q_target = reward_b + (1 - done_b) * gamma * next_q

            loss = loss_fn(q_values, q_target)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        if episode % update_target_steps == 0:
            target_model.load_state_dict(model.state_dict())
        if epsilon > epsilon_min:
            epsilon *= epsilon_decay

        reward_history.append(total_reward)
        epsilon_history.append(epsilon)

        print(f"Episode {episode+1}, Total Reward: {total_reward:.2f}, Epsilon: {epsilon:.3f}")

    torch.save(model.state_dict(), "dqn_battleship.pth")
    print("訓練完成並儲存模型")

    # 第一張圖：Total Reward
    plt.figure(figsize=(10, 5))
    plt.plot(reward_history, label="Total Reward", color='blue')
    plt.xlabel("Episode")
    plt.ylabel("Total Reward")
    plt.title("DQN Training - Total Reward Over Episodes")
    plt.grid(True)
    plt.legend()
    plt.tight_layout()
    plt.savefig("reward_plot.png")
    plt.show()

    # 第二張圖：Epsilon
    plt.figure(figsize=(10, 5))
    plt.plot(epsilon_history, label="Epsilon", color='orange')
    plt.xlabel("Episode")
    plt.ylabel("Epsilon")
    plt.title("DQN Training - Epsilon Over Episodes")
    plt.grid(True)
    plt.legend()
    plt.tight_layout()
    plt.savefig("epsilon_plot.png")
    plt.show()

if __name__ == "__main__":
    train()
