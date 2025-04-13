# 構建階段
FROM node:18-alpine as build

WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製源代碼
COPY . .

# 設置環境變量跳過檢查
ENV NEXT_TELEMETRY_DISABLED=1
ENV DISABLE_ESLINT_PLUGIN=true
ENV NODE_ENV=production
ENV SKIP_PREFLIGHT_CHECK=true
ENV ESLINT_NO_DEV_ERRORS=true
ENV TSC_COMPILE_ON_ERROR=true
ENV NEXT_PUBLIC_API_URL=http://backend:8081

# 構建應用
RUN npm run build

# 生產階段
FROM node:18-alpine

WORKDIR /app

# 從構建階段複製必要文件
COPY --from=build /app/next.config.js ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# 暴露端口
EXPOSE 3000

# 啟動應用
ENV PORT=3000
CMD ["node", "server.js"] 