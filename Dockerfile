# Frontend image for the Compose stack (backend/compose.yaml, decision D-P1). Builds from the pinned
# contract/ submodule: api:generate regenerates the client inside the image (NFR-12).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
