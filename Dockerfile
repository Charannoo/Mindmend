# MindMend: Express backend + static Frontend (single container)
FROM node:20-bookworm-slim

WORKDIR /app

COPY Backend/package.json Backend/package-lock.json ./Backend/
RUN cd Backend && npm ci --omit=dev

COPY Backend ./Backend
COPY Frontend ./Frontend

ENV NODE_ENV=production
WORKDIR /app/Backend

EXPOSE 3000
CMD ["node", "server.js"]
