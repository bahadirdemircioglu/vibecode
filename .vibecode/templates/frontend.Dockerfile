# Frontend Dockerfile template → copy to frontend/Dockerfile
# (.vibecode/standards/docker.md §8 lists the rules this satisfies)
FROM node:20-alpine

WORKDIR /app

# Lock file BEFORE install → reproducible + cached layer
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

USER node

# --port 3000 matches docker-compose.yml (mapping + healthcheck); Vite's default is 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
