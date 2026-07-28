# Stage 1: build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/frontend

COPY App/frontend/package*.json ./
RUN npm install

COPY App/frontend/ .
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
