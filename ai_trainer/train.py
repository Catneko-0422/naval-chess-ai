import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque
import random
import os
from datetime import datetime

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
    def __init__(self, board_size=10):
        self.board_size = board_size
        self.input_size = board_size * board_size * 2  # 自己的棋盤和對手的棋盤
        self.output_size = board_size * board_size
        self.hidden_size = 256
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = DQN(self.input_size, self.hidden_size, self.output_size).to(self.device)
        self.target_model = DQN(self.input_size, self.hidden_size, self.output_size).to(self.device)
        self.target_model.load_state_dict(self.model.state_dict())
        
        self.optimizer = optim.Adam(self.model.parameters(), lr=0.001)
        self.memory = deque(maxlen=10000)
        
        self.gamma = 0.99
        self.epsilon = 1.0
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.995
        self.batch_size = 64
        
    def get_state(self, my_board, opponent_board):
        """將棋盤狀態轉換為神經網絡輸入"""
        state = np.zeros((self.board_size, self.board_size, 2))
        state[:,:,0] = my_board
        state[:,:,1] = opponent_board
        return torch.FloatTensor(state.flatten()).to(self.device)
    
    def remember(self, state, action, reward, next_state, done):
        """存儲經驗到記憶中"""
        self.memory.append((state, action, reward, next_state, done))
    
    def act(self, state, valid_moves):
        """根據當前狀態選擇動作"""
        if random.random() <= self.epsilon:
            return random.choice(valid_moves)
        
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
    
    def replay(self):
        """從記憶中學習"""
        if len(self.memory) < self.batch_size:
            return
        
        batch = random.sample(self.memory, self.batch_size)
        states = torch.stack([x[0] for x in batch])
        actions = torch.tensor([x[1] for x in batch]).to(self.device)
        rewards = torch.tensor([x[2] for x in batch]).to(self.device)
        next_states = torch.stack([x[3] for x in batch])
        dones = torch.tensor([x[4] for x in batch]).to(self.device)
        
        current_q_values = self.model(states).gather(1, actions.unsqueeze(1))
        next_q_values = self.target_model(next_states).max(1)[0].detach()
        target_q_values = rewards + (1 - dones) * self.gamma * next_q_values
        
        loss = nn.MSELoss()(current_q_values, target_q_values.unsqueeze(1))
        
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
        
        # 更新epsilon
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        
        # 定期更新目標網絡
        if random.random() < 0.1:
            self.target_model.load_state_dict(self.model.state_dict())
    
    def get_valid_moves(self, board):
        """獲取所有有效的移動"""
        valid_moves = []
        for row in range(self.board_size):
            for col in range(self.board_size):
                if board[row][col] == 0:  # 0表示未攻擊的位置
                    valid_moves.append((row, col))
        return valid_moves
    
    def train(self, episodes=1000, save_interval=100):
        """訓練AI"""
        os.makedirs('models', exist_ok=True)
        
        for episode in range(episodes):
            # 初始化遊戲狀態
            my_board = np.zeros((self.board_size, self.board_size))
            opponent_board = np.zeros((self.board_size, self.board_size))
            state = self.get_state(my_board, opponent_board)
            done = False
            total_reward = 0
            
            while not done:
                valid_moves = self.get_valid_moves(opponent_board)
                if not valid_moves:
                    break
                
                action = self.act(state, valid_moves)
                row, col = action
                
                # 執行動作並獲取獎勵
                reward = self.simulate_move(opponent_board, row, col)
                next_state = self.get_state(my_board, opponent_board)
                
                # 檢查遊戲是否結束
                done = self.is_game_over(opponent_board)
                
                # 存儲經驗
                self.remember(state, action, reward, next_state, done)
                
                state = next_state
                total_reward += reward
                
                # 從記憶中學習
                self.replay()
            
            print(f"Episode {episode + 1}, Total Reward: {total_reward}, Epsilon: {self.epsilon}")
            
            # 定期保存模型
            if (episode + 1) % save_interval == 0:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                self.save_model(f'models/naval_chess_ai_{timestamp}.pt')
    
    def simulate_move(self, board, row, col):
        """模擬移動並返回獎勵"""
        if board[row][col] == 1:  # 擊中船隻
            board[row][col] = 2  # 標記為已擊中
            return 1
        else:
            board[row][col] = 3  # 標記為未擊中
            return -0.1
    
    def is_game_over(self, board):
        """檢查遊戲是否結束"""
        return np.sum(board == 1) == 0  # 所有船隻都被擊中
    
    def save_model(self, path):
        """保存模型"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'target_model_state_dict': self.target_model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'epsilon': self.epsilon
        }, path)
        print(f"Model saved to {path}")
    
    def load_model(self, path):
        """加載模型"""
        checkpoint = torch.load(path)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.target_model.load_state_dict(checkpoint['target_model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.epsilon = checkpoint['epsilon']
        print(f"Model loaded from {path}")

if __name__ == '__main__':
    # 創建AI實例
    ai = NavalChessAI()
    
    # 開始訓練
    print("Starting AI training...")
    ai.train(episodes=1000, save_interval=100)
    
    # 保存最終模型
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ai.save_model(f'models/naval_chess_ai_final_{timestamp}.pt')
    
    print("Training completed!") 