#!/bin/bash

set -ex
IMAGE_NAME="jincort/backend-token-wallets"
DOCKER_FILE="Dockerfile.$TAG"
DOCKER_FILE=$( [ -e "$DOCKER_FILE" ] && echo $DOCKER_FILE || echo Dockerfile )
docker login -u $DOCKER_USER -p $DOCKER_PASS
docker build -f $DOCKER_FILE -t ${IMAGE_NAME}:${TAG} . || exit 1
docker push ${IMAGE_NAME}:${TAG}
