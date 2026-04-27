FROM node:20-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Accept build argument for API base URL
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

EXPOSE 5173

CMD ["npm", "run", "dev"]
