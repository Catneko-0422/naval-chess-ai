# Dockerfile
FROM node:20-alpine AS base

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "start"]
