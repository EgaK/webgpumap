#!/bin/bash

PROJECT_DIR=$(cd $(dirname $0);pwd)
cd $PROJECT_DIR

(
    sleep 3; open -a 'Google Chrome' https://192.168.11.2/ &
) &

    echo -e "\n開発環境スタート"
    projdir=$(cd $(dirname $0);pwd)

(
    trap 'echo " 終了"; kill 0' EXIT

    wrangler dev -c dist/wrangler.jsonc &

    fswatch $projdir/src |
    while read -r filepath; do
        node build.js $filepath $projdir
    done &

    wait
)
