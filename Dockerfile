# Railway cache-bust: v3-$(date +%s)
FROM node:22-slim AS builder

WORKDIR /app

# Cache-bust: forces rebuild of all subsequent layers
RUN echo "rebuild-2026-06-28-v3" > /dev/null

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-slim AS runtime

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/boot.cjs"]
