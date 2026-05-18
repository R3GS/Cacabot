FROM node:25-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev
COPY package*.json .
RUN npm install
COPY . .
ENV NODE_ENV=production
CMD [ "node", "index.js" ]
