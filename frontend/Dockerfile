#Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY .env.production .env

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
