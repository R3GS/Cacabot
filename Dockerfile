FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY pnpm-lock.yaml .
RUN npm i -g pnpm
RUN pnpm i
COPY . .
ENV NODE_ENV=production
VOLUME ["/data"]
CMD [ "pnpm", "start" ]
