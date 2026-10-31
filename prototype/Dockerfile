FROM node:22-alpine AS build
WORKDIR /app
COPY prototype/package*.json ./
RUN npm ci --no-audit --no-fund
COPY prototype/ ./
RUN npm run build
FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client /usr/share/nginx/html
