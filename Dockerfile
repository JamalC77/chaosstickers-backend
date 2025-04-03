# Dockerfile

# Use an official Node.js runtime as a parent image
# Choose a version compatible with your project (e.g., 18, 20)
# Using Alpine Linux variants can be smaller but sometimes lack libraries needed by native modules.
# Start with a standard Debian-based image (like 'bookworm') for better compatibility.
FROM node:20-bookworm-slim

# Install OpenSSL (recommended by Prisma warning)
RUN apt-get update -y && apt-get install -y openssl

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# If using Prisma, copy the schema
COPY prisma ./prisma/

# Install app dependencies (including devDependencies needed for build)
RUN npm install

# If using Prisma, generate the client
# Use --no-engine if your database is remote and you don't need the query engine binaries
# Or omit --no-engine if Prisma needs its engine locally (e.g., for migrations during build)
RUN npx prisma generate --no-engine

# Bundle app source inside Docker image
COPY . .

# Build TypeScript code
RUN npm run build
# Or your specific build command if different

# Create directory and copy Imgly assets from installed node_modules within the container
RUN mkdir -p /app/assets/imgly && \
    cp node_modules/@imgly/background-removal-node/dist/*.{wasm,onnx} /app/assets/imgly/

# Make port 3001 available to the world outside this container (adjust if needed)
EXPOSE 3001

# Define environment variable if needed (e.g., for NODE_ENV)
# ENV NODE_ENV=production

# Command to run the application
CMD ["node", "dist/server.js"] 