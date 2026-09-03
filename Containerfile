# Build context is the project directory:
#   podman build -f Containerfile -t schwaerzwerk .

FROM dhi.io/node:25-debian13-dev AS build
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY vite.config.js index.html ./
COPY src/ ./src/
RUN pnpm exec vite build

FROM dhi.io/node:25-debian13
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY serve.mjs ./serve.mjs
EXPOSE 3000
HEALTHCHECK NONE
CMD ["node", "serve.mjs"]
