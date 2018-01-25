FROM mhart/alpine-node:8.6

WORKDIR /usr/src/app
ADD . /usr/src/app

RUN apk add --update --no-cache git python make g++ && \
    npm install && \
    npm run build && \
    npm prune --production && \
    apk del --purge git python make g++ && \
    rm -rf ./src ./test

CMD npm run serve
