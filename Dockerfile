FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    NIYAMSETU_PORT=8765 \
    NIYAMSETU_DATA_DIR=/app/data

COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend
COPY scripts ./scripts
COPY data/golden_circular.txt ./data/golden_circular.txt

RUN mkdir -p /app/data

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/healthcheck.js

CMD ["npm", "start"]