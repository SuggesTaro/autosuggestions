#!/bin/bash

dbnames=( keywords sentences similar_keywords)

#bash couchdb-backup.sh -b -H 127.0.0.1 -d my-db -f dumpedDB.json -u admin -p password
rm -fr *json
for i in "${dbnames[@]}"
do
        bash couchdb-backup.sh -b -H aqueous-thicket-68007.herokuapp.com -P 80 -d $i -f $i".json"
done