import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import random
import matplotlib.pyplot as plt
from collections import deque
from .utils import BOARD_SIZE, SHIP_SIZES
from .env import BattleshipEnv


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
        state_np = env.reset()
        state = torch.FloatTensor(state_np).unsqueeze(0)
        total_reward = 0

        for t in range(100):
            if random.random() < epsilon:
                action = random.randint(0, BOARD_SIZE * BOARD_SIZE - 1)
            else:
                with torch.no_grad():
                    q_values = model(state).squeeze()
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
