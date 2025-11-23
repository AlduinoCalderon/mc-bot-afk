FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY index.js ./

# Optimizar Node.js para usar menos memoria
ENV NODE_OPTIONS="--max-old-space-size=400 --optimize-for-size"

CMD ["node", "index.js"]

