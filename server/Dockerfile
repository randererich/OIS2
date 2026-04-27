FROM node:20-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Copy .env.example to .env if .env doesn't exist
RUN [ ! -f .env ] && cp .env.example .env || true

EXPOSE 3000

CMD ["npm", "run", "dev"]
