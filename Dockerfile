FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev fontconfig freetype-dev ttf-dejavu ttf-freefont
COPY package*.json .
RUN npm install
COPY . .
RUN mkdir -p /usr/share/fonts && cp *.[ot]tf /usr/share/fonts/ 2>/dev/null || true && fc-cache -fv
ENV NODE_ENV=production
CMD [ "node", "index.js" ]
