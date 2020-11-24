FROM node:12
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --unsafe-perm
COPY . .
ENTRYPOINT [ "npm", "run", "start-cluster", "--"]
