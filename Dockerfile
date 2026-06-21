FROM mcr.microsoft.com/playwright:v1.61.0-noble
WORKDIR /work
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["./scripts/run-playwright.sh"]
