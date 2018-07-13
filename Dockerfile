FROM mhart/alpine-node:10

WORKDIR /usr/src/app
ADD . /usr/src/app

RUN apk add --update --no-cache git && \
    npm prune --production && \
    npm install --production && \
    rm -rf ./src ./test /root/.npm/_cacache && \
    apk del git

CMD npm run serve
