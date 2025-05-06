import os
import torch
import numpy as np
from .battleship_board import generate_board
from .env import BattleshipEnv
from .dqn_battleship import DQN, BOARD_SIZE, get_allowed_actions

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, "dqn_battleship.pth")

def evaluate(model_path=MODEL_PATH, board=generate_board()['board']):
    model = DQN()
    model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval()
    env = BattleshipEnv(board)
    env.ship_board = board
    result = []
    state_feature = env.reset()
    done = False
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
        result.append([x,y])
        state_feature, reward, done = env.step(action)
    return result
