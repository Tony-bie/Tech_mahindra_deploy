FROM node:26-alpine
WORKDIR /app

RUN npm install -g pnpm

ENV CI=true


COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

RUN pnpm approve-builds --all
RUN pnpm install


COPY . .
EXPOSE 8081
EXPOSE 8080
CMD ["pnpm","start"]