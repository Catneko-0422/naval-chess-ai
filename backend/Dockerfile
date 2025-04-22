FROM python:3.9-slim

WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴文件
COPY requirements.txt .

# 安裝Python依賴
RUN pip install --no-cache-dir -r requirements.txt

# 創建模型目錄
RUN mkdir -p /app/models

# 複製模型文件
# COPY models/* /app/models/

# 複製應用代碼
COPY . .

# 設置環境變量
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
ENV EVENTLET_NO_GREENDNS=yes

# 暴露端口
EXPOSE 8081

# 啟動應用
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8081"] 