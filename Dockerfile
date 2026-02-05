FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY packages/backend/package.json ./packages/backend/

RUN npm install -w packages/backend

COPY packages/backend ./packages/backend

EXPOSE 3000

CMD ["npm", "run", "--workspace", "packages/backend", "start"]
