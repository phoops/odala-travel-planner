#!/bin/sh
PROJECT_NAME=digitransit-ui
DATE_TAG=$(date +%Y%m%d%H%M%S)
docker build -f Dockerfile -t ${PROJECT_NAME}:${DATE_TAG} -t nexus.phoops.it/phoops/${PROJECT_NAME}:${DATE_TAG} --build-arg NPM_TOKEN=$(echo $NPM_TOKEN) .
if test $? -eq 0
then
    printf "You can push this image with:\ndocker push nexus.phoops.it/phoops/${PROJECT_NAME}:${DATE_TAG}\n"
else
    printf "ERROR building docker image!"
fi
