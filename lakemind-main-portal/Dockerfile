# Stage 1: Build
FROM node:20-alpine as lakemind_portal_main
WORKDIR /app
COPY . ./
RUN apk add git
RUN yarn install --immutable --immutable-cache
RUN yarn run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
COPY --from=lakemind_portal_main /app/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
