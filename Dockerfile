FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/src ./src

EXPOSE 80
CMD ["npm", "start"]
