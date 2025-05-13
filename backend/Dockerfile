# 使用官方 Python 基礎映像檔
FROM python:3.11

# 設定工作目錄
WORKDIR /app

# 複製應用程式檔案
COPY . .

# 安裝所需套件
RUN pip install --no-cache-dir -r requirements.txt

# 暴露 Socket.IO 端口
EXPOSE 5000

# 啟動 Flask + Socket.IO 應用
CMD ["python", "app.py"]

