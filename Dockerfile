FROM node:24.20.0-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM node:24.20.0-bookworm-slim AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.20.0-bookworm-slim AS runtime

ENV HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf \
        /var/lib/apt/lists/* \
        /usr/local/lib/node_modules/corepack \
        /usr/local/lib/node_modules/npm \
        /opt/yarn-v1.22.22 \
    && rm -f \
        /usr/local/bin/corepack \
        /usr/local/bin/npm \
        /usr/local/bin/npx \
        /usr/local/bin/pnpm \
        /usr/local/bin/pnpx \
        /usr/local/bin/yarn \
        /usr/local/bin/yarnpkg \
    && groupadd --system --gid 10001 nodejs \
    && useradd --system --uid 10001 --gid nodejs --home-dir /nonexistent --shell /usr/sbin/nologin nextjs

COPY --from=builder --chown=10001:10001 /app/.next/standalone ./

USER 10001:10001

CMD ["node", "server.js"]
