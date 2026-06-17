import torch
from battleship_board import generate_board
from env import BattleshipEnv
from dqn_battleship import DQN
from utils import BOARD_SIZE, get_allowed_actions


def print_board(board, title="棋盤"):
    print(f"\n{title}")
    for row in board:
        print(" ".join(str(cell) for cell in row))
    print()


def evaluate(model_path="dqn_battleship.pth", board=None, episodes=10):
    if board is None:
        board = generate_board()['board']
    model = DQN()
    model.load_state_dict(torch.load(model_path))
    model.eval()
    env = BattleshipEnv(board)
    total_steps = []
    for ep in range(episodes):
        state_feature = env.reset()
        done = False
        steps = 0
        print(f"\n--- Episode {ep+1} ---")
        print_board(env.ship_board, title="Hidden board (1 = ship)")
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
            print(f"Step {steps+1}: AI attacks ({x}, {y})")
            state_feature, reward, done = env.step(action)
            print_board(env.state, title="State (0:untouched, 1:miss, 2:hit, 3:sunk)")
            steps += 1
        total_steps.append(steps)
        print(f"Episode done in {steps} steps")
    avg_steps = sum(total_steps) / episodes
    print(f"\nAverage steps: {avg_steps:.2f}")


if __name__ == "__main__":
    evaluate("dqn_battleship.pth", generate_board()['board'], 1)
