# Dockerfile para Railway - CBVP Fullstack
# Build con esboot en formato CJS (evita bug de import.meta.url en ESM bundle)

# -------- Etapa 1: Builder --------
FROM node:22-slim AS builder

WORKDIR /app

# Copiar package files
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copiar todo el codigo fuente
COPY . .

# Build: frontend (vite) + backend (esbuild CJS bundle)
RUN npm run build

# -------- Etapa 2: Runtime --------
FROM node:22-slim AS runtime

WORKDIR /app

# Copiar solo lo necesario para produccion
# boot.js es un bundle CJS autocontenido (31mb) con todo incluido
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/boot.js"]
