FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY pnpm-lock.yaml .
RUN npm i -g pnpm
RUN pnpm approve-builds canvas || true && pnpm i --no-frozen-lockfile
COPY . .
ENV NODE_ENV=production
CMD [ "pnpm", "start" ]
