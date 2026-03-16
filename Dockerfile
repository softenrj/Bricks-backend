FROM node:20 AS build

WORKDIR /usr/src/app

COPY package*.json .

RUN npm install

COPY . .
RUN npm run build


FROM node:22-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install


COPY --chown=node --from=build /usr/src/app/dist ./dist
COPY --from=build --chown=node:node /usr/src/app/src/docs ./src/docs
USER node

EXPOSE 8000

CMD [ "npm", "start" ]

