FROM node:20 as base

RUN npm install -g npm@10.7.0

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20 as production

RUN npm install -g npm@10.7.0

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install --omit=dev

COPY --from=base /usr/src/app/dist ./dist

## typeorm.config.prod.js not required when using synchronize in env

## check script not required; rely on service startup and app retries

RUN groupadd -g 1001 nodejs && \
  useradd -u 1001 -g nodejs -m -s /bin/bash nestjs

RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api-docs || exit 1

CMD ["node", "dist/main"]