# Dockerfile para Railway/Render - CBVP Fullstack
# Construye frontend (Vite) + backend (Hono/Node) y sirve todo desde el servidor
# Usa node:20-slim (Debian) en vez de Alpine para mayor compatibilidad con npm

# -------- Etapa 1: Builder --------
FROM node:20-slim AS builder

WORKDIR /app

# Copiar package files primero (para cache de layers)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copiar todo el codigo fuente
COPY . .

# Build: frontend (vite) + backend (esbuild)
# Esto genera dist/public/ (frontend) y dist/boot.js (backend)
RUN npm run build

# -------- Etapa 2: Runtime --------
FROM node:20-slim AS runtime

WORKDIR /app

# Copiar solo lo necesario para produccion
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Instalar SOLO dependencias de produccion
RUN npm ci --production --no-audit --no-fund 2>/dev/null || true

# Puerto configurable via env var
ENV NODE_ENV=production
ENV PORT=3000

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/boot.js"]
