FROM oven/bun:1.2

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ENV PORT=8787
ENV REMOTE_CONTROL_API_BASE_URL="http://114.132.238.32:8787"
EXPOSE 8787

CMD ["bun", "run", "start"]
