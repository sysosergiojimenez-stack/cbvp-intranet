# Dockerfile para Google Cloud Run
# Compila backend con esbuild y ejecuta con node (mas rapido que tsx)

FROM node:22-slim

WORKDIR /app

# Instalar dependencias
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copiar codigo fuente
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN npm run build

# Puerto - Cloud Run asigna PORT automaticamente
ENV NODE_ENV=production

EXPOSE 8080

# Ejecutar backend compilado
CMD ["node", "dist/server.js"]
