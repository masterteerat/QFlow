# Stage 1: build the React frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /usr/src/frontend

COPY App/frontend/package*.json ./
RUN npm ci

COPY App/frontend/ .
RUN npm run build

# Stage 2: Express backend, serving the built frontend
FROM node:22-alpine
WORKDIR /usr/src/app

# give the non-root 'node' user ownership of the app dir
RUN chown node:node /usr/src/app
USER node

# production dependencies only (smaller image)
COPY --chown=node:node App/backend/package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node App/backend/ .
COPY --chown=node:node --from=frontend-builder /usr/src/frontend/dist ./public

# create the uploads dir as 'node' BEFORE the volume is mounted,
# so the named volume inherits node's ownership and uploads can be written
RUN mkdir -p uploads/business

EXPOSE 3000
CMD ["npm", "start"]