FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# The committed lockfile predates npm's peer-dependency resolution used by the
# Node 22 image. Install reconciles the optional Vite YAML peer dependency
# instead of failing the container build before the application is compiled.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run prisma:generate && npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund && npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
RUN addgroup -S imadi && adduser -S imadi -G imadi && chown -R imadi:imadi /app
USER imadi
EXPOSE 3000
CMD ["npm", "run", "start:production"]
