# syntax = docker/dockerfile:1

# Builds the browser client with Vite, then runs the Node server, which serves
# the client, the API and WebSocket, and README.md rendered at /readme/.
# Node runs the server's TypeScript directly (type stripping), so only the
# client needs a build step. SQLite lives on the /data volume.

FROM docker.io/library/node:24.21.0-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts ./
COPY src ./src
RUN pnpm build
RUN pnpm install --frozen-lockfile --prod

FROM docker.io/library/node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY src ./src
COPY README.md PROCESS.md ./
COPY docs ./docs
COPY reflections ./reflections
CMD ["node", "--max-old-space-size=160", "src/server/main.ts"]
