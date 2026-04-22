# Stage 1: Build
FROM node:20-alpine as lakemind_root
WORKDIR /app
COPY . ./
RUN apk add git
RUN yarn install --immutable --immutable-cache
RUN yarn run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
COPY --from=lakemind_root /app/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
