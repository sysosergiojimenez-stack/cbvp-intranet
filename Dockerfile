# Dockerfile para Railway - CBVP Fullstack
# Usa node:22-slim que incluye npm 10.9+ nativamente, evitando el bug de Railway

# -------- Etapa 1: Builder --------
FROM node:22-slim AS builder

WORKDIR /app

# Copiar package files primero (para cache de layers)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copiar todo el codigo fuente
COPY . .

# Build: frontend (vite) + backend (esbuild)
RUN npm run build

# -------- Etapa 2: Runtime --------
FROM node:22-slim AS runtime

WORKDIR /app

# Copiar solo lo necesario para produccion
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Instalar SOLO dependencias de produccion (si boot.js las necesita en runtime)
RUN npm ci --production --no-audit --no-fund 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/boot.js"]
