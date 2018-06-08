FROM mhart/alpine-node:10

WORKDIR /usr/src/app

RUN apk add --update --no-cache git python make g++ && \
    npm install && \
    apk del --purge git python make g++

VOLUME /usr/src/app
EXPOSE 3000
