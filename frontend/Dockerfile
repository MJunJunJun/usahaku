# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn config set registry https://registry.npmjs.org && \
    yarn config set network-timeout 600000 && \
    for i in 1 2 3; do \
      yarn install --frozen-lockfile --non-interactive && exit 0; \
      echo "yarn install failed (attempt ${i}/3), retrying..."; \
      sleep 5; \
    done; \
    exit 1

COPY . .
ARG REACT_APP_BACKEND_URL=
ARG REACT_APP_BRAND_NAME=UsahaKu
ARG REACT_APP_PUBLIC_SITE_HOST=
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_BRAND_NAME=$REACT_APP_BRAND_NAME
ENV REACT_APP_PUBLIC_SITE_HOST=$REACT_APP_PUBLIC_SITE_HOST
RUN yarn build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
