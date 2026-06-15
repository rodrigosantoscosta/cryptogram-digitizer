FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

RUN npm prune --production

EXPOSE 4000

CMD ["node", "dist/server.js"]
