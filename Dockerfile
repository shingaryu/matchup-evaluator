FROM node:12
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm config set unsafe-perm true
RUN npm install
COPY . .
ENTRYPOINT [ "npm", "run", "start-cluster", "--"]
