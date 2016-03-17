#!/bin/bash

dbnames=( keywords sentences similar_keywords )

#bash couchdb-backup.sh -b -H 127.0.0.1 -d my-db -f dumpedDB.json -u admin -p password

for i in "${dbnames[@]}"
do
    echo "Importing "$i
    curl -X PUT http://localhost:$PORT/$i
    bash couchdb-backup.sh -r -H localhost -P $PORT -d $i -f $i".json"
    # curl -X PUT http://suggest.creativegeek.ph/$i
    # bash couchdb-backup.sh -r -H suggest.creativegeek.ph -P 80 -d $i -f $i".json"    
done