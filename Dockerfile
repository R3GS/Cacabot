FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY pnpm-lock.yaml .
RUN npm i -g pnpm
RUN pnpm i
COPY . .

# EXPOSE 3000
ENV NODE_ENV=production
CMD [ "pnpm", "start" ]