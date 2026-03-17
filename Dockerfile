# Stage 1 — build Vite frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — production Express server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY server.js ./
COPY src/data ./src/data

# Data directories (overridden by volumes in docker-compose)
RUN mkdir -p raw-data

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server.js"]
