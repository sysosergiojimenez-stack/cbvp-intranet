# Dockerfile para Google Cloud Run
# Backend Node.js + Frontend React (Vite)

FROM node:22-slim

WORKDIR /app

# Instalar dependencias
COPY package.json ./
RUN npm install --no-audit --no-fund

# Instalar tsx globalmente
RUN npm install -g tsx

# Copiar codigo fuente
COPY . .

# Build del frontend (Vite)
RUN npx vite build

# Puerto - Cloud Run asigna PORT automaticamente
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Ejecutar backend
CMD ["tsx", "api/boot.ts"]
