# Dockerfile para Railway - CBVP Fullstack
# Usa npm install (no npm ci) para evitar bug "Exit handler never called!" de Railway
# Pnpm o yarn serian mejores alternativas pero npm install funciona

# -------- Etapa 1: Builder --------
FROM node:22-slim AS builder

WORKDIR /app

# Copiar package files
COPY package.json ./
RUN npm install --no-audit --no-fund

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

# Instalar dependencias de produccion (boot.js puede necesitar superjson u otras en runtime)
RUN npm install --production --no-audit --no-fund 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/boot.js"]
