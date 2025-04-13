import numpy as np
import torch
import torch.nn as nn
import os

class DQN(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super(DQN, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, output_size)
        
    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)

class NavalChessAI:
    def __init__(self, board_size=10, model_path=None):
        self.board_size = board_size
        self.input_size = board_size * board_size * 2  # 自己的棋盤和對手的棋盤
        self.output_size = board_size * board_size
        self.hidden_size = 256
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = DQN(self.input_size, self.hidden_size, self.output_size).to(self.device)
        
        # 加載預訓練模型
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            print(f"Warning: Model file not found at {model_path}")
    
    def get_state(self, my_board, opponent_board):
        """將棋盤狀態轉換為神經網絡輸入"""
        state = np.zeros((self.board_size, self.board_size, 2))
        state[:,:,0] = my_board
        state[:,:,1] = opponent_board
        return torch.FloatTensor(state.flatten()).to(self.device)
    
    def get_valid_moves(self, board):
        """獲取所有有效的移動"""
        valid_moves = []
        for row in range(self.board_size):
            for col in range(self.board_size):
                if board[row][col] == 0:  # 0表示未攻擊的位置
                    valid_moves.append((row, col))
        return valid_moves
    
    def make_move(self, my_board, opponent_board):
        """根據當前狀態做出移動"""
        state = self.get_state(my_board, opponent_board)
        valid_moves = self.get_valid_moves(opponent_board)
        if not valid_moves:
            return None
        
        with torch.no_grad():
            state = state.unsqueeze(0)
            q_values = self.model(state)
            
        # 只考慮有效移動
        valid_q_values = torch.zeros(self.output_size).to(self.device)
        for move in valid_moves:
            row, col = move
            action_idx = row * self.board_size + col
            valid_q_values[action_idx] = q_values[0][action_idx]
        
        return valid_moves[torch.argmax(valid_q_values).item()]
    
    def load_model(self, path):
        """加載模型"""
        checkpoint = torch.load(path)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        print(f"Model loaded from {path}") 