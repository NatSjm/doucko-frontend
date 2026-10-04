# Frontend image for the Compose stack (backend/compose.yaml, decision D-P1). Builds from the pinned
# contract/ submodule: api:generate regenerates the client inside the image (NFR-12), so the build
# stops if the submodule was not checked out (`git submodule update --init`).
# Base images are pinned by digest; bump them deliberately (node 22.23.3, nginx stable 1.30.5).
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN test -f contract/api/openapi.yaml || { echo "contract/api/openapi.yaml missing: run git submodule update --init" >&2; exit 1; }
RUN npm run build

FROM nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
