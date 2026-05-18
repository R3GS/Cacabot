FROM node:25-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev fontconfig
COPY package*.json .
RUN npm install
COPY . .
RUN cp "./Cowboy Movie.ttf" /usr/share/fonts/ && fc-cache -f
ENV NODE_ENV=production
CMD [ "node", "index.js" ]
