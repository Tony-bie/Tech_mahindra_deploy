FROM node:26-alpine AS build
WORKDIR /app

RUN npm install -g pnpm

ENV CI=true

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./


RUN pnpm install

COPY . .

RUN pnpm run build

FROM nginx AS runner

COPY docker/nginx.conf /etc/nginx/nginx.conf

COPY --chown=nginx:nginx --from=build /app/build /usr/share/nginx/html

USER nginx

EXPOSE 3000

ENTRYPOINT ["nginx", "-c", "/etc/nginx/nginx.conf"]
CMD ["-g", "daemon off;"]