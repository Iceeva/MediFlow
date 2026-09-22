# Local development image ONLY. Production runs on Vercel, not in this container.
FROM node:22-bookworm-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npx prisma generate

EXPOSE 3000
ENTRYPOINT ["sh", "/app/docker/dev-entrypoint.sh"]
