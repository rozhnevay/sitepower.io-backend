FROM node:11-alpine
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
COPY . .

ENTRYPOINT [ "npm", "start" ]