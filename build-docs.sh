#!/bin/bash

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a s    ymlink
    SELF="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative s    ymlink, we need to resolve it relative to the path where the symlink file wa    s located
done

SELF="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

cd $SELF

if [ ! -e node_modules/yuidoc2md/bin ]; then
	npm install yuidoc2md
	npm install yuidocjs
fi

node node_modules/yuidoc2md/bin/cli.js  devjsUtils.js > DOC.md

cd -

