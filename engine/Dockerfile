# QuantView engine container (Cloudflare Containers). Same engine as the phone app, run 24/7 in headless Chromium.
# Slim image (only Chromium, no Firefox/WebKit) so it fits the "basic" instance disk (4 GB).
FROM node:22-bookworm-slim
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npx playwright install --with-deps --only-shell chromium \
 && rm -rf /root/.npm /var/lib/apt/lists/*
COPY server.js ./
COPY app ./app
ENV DATA_DIR=/tmp/qvdata PORT=8787 NODE_ENV=production
EXPOSE 8787
CMD ["node","server.js"]
