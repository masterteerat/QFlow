# Stage 1: build the React frontend
# FRONTEND_DIR picks the UI: 'frontend' (original, default) or 'frontend-v2' (redesign).
#   docker compose build --build-arg FRONTEND_DIR=frontend-v2
FROM node:20-alpine AS frontend-builder
ARG FRONTEND_DIR=frontend
WORKDIR /usr/src/frontend

COPY App/${FRONTEND_DIR}/package*.json ./
RUN npm install

COPY App/${FRONTEND_DIR}/ .
RUN npm run build

# Stage 2: Express backend, serving the built frontend
FROM node:20-alpine
WORKDIR /usr/src/app

COPY App/backend/package*.json ./
RUN npm install

COPY App/backend/ .
COPY --from=frontend-builder /usr/src/frontend/dist ./public

EXPOSE 3000
CMD ["npm", "start"]
