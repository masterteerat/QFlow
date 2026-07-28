# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/frontend

# Install frontend dependencies
COPY App/frontend/package*.json ./
RUN npm install

# Copy frontend source and build it
COPY App/frontend/ .
RUN npm run build

# --- Stage 2: Setup the Express Backend ---
FROM node:20-alpine
WORKDIR /usr/src/app

# Install backend dependencies
COPY App/backend/package*.json ./
RUN npm install

# Copy backend code
COPY App/backend/ .

# Grab the compiled React files from Stage 1 and put them in the backend's 'public' folder
COPY --from=frontend-builder /usr/src/frontend/dist ./public

# Expose the port and start the server
EXPOSE 3000
CMD ["npm", "start"]