FROM node:20-alpine AS web-build

WORKDIR /web

COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src

ENV VITE_API_BASE_URL=
ENV VITE_BASE_PATH=/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/src ./src
COPY --from=web-build /web/dist ./public

EXPOSE 80
CMD ["npm", "start"]
