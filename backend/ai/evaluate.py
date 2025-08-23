# backend/ai/evaluate.py

import torch
import numpy as np
from battleship_board import generate_board
from env import BattleshipEnv
from dqn_battleship import DQN, BOARD_SIZE, get_allowed_actions

board = generate_board()['board']

def print_board(board, title="棋盤"):
    print(f"\n📘 {title}")
    for row in board:
        print(" ".join(str(cell) for cell in row))
    print()

def evaluate(model_path="dqn_battleship.pth", board=generate_board()['board'], episodes=10):
    model = DQN()
    model.load_state_dict(torch.load(model_path))
    model.eval()
    env = BattleshipEnv(board)
    env.ship_board = board
    total_steps = []
    for ep in range(episodes):
        state_feature = env.reset()
        done = False
        steps = 0
        print(f"\n🎮 --- Episode {ep+1} ---")
        print_board(env.ship_board, title="隱藏船艦棋盤（1 表示船，僅供參考）")
        while not done:
            allowed_moves = get_allowed_actions(env)
            state_tensor = torch.FloatTensor(state_feature).unsqueeze(0)
            with torch.no_grad():
                q_values = model(state_tensor).squeeze()
                for i in range(BOARD_SIZE * BOARD_SIZE):
                    if i not in allowed_moves:
                        q_values[i] = -1e9
                action = torch.argmax(q_values).item()
            x, y = divmod(action, BOARD_SIZE)
            print(f"🔍 Step {steps+1}: AI 攻擊座標 ({x}, {y})")
            state_feature, reward, done = env.step(action)
            print_board(env.state, title="目前遊戲狀態（0: 未攻擊, 1: 未命中, 2: 命中, 3: 沈沒）")
            steps += 1
        total_steps.append(steps)
        print(f"✅ 本局完成，共 {steps} 步")
    avg_steps = sum(total_steps) / episodes
    print(f"\n✨ 平均完成步數：{avg_steps:.2f} 步")

if __name__ == "__main__":
    evaluate("dqn_battleship.pth", generate_board()['board'], 1)
