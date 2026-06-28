# Dockerfile SIMPLE para Railway - Sin esbuild bundle
# Ejecuta TypeScript directamente con tsx (más confiable que bundle CJS)

FROM node:22-slim

WORKDIR /app

# Instalar dependencias
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copiar código fuente
COPY . .

# Build solo del frontend (Vite)
RUN npx vite build

# Puerto y entorno
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Ejecutar backend directamente con tsx (sin bundle de esbuild)
CMD ["npx", "tsx", "api/boot.ts"]
