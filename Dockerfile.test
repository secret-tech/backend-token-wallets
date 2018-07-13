FROM mhart/alpine-node:10

WORKDIR /usr/src/app
ADD . /usr/src/app

RUN apk update && apk upgrade && apk add git python curl make g++
RUN npm install

CMD npm test
