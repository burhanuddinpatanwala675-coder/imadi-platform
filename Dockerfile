FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
RUN addgroup -S imadi && adduser -S imadi -G imadi && chown -R imadi:imadi /app
USER imadi
EXPOSE 3000
CMD ["npm", "run", "start:production"]
