# heroku-couchdb

To run

```
heroku create
heroku buildpacks:add --index 1 https://github.com/ddollar/heroku-buildpack-apt
heroku buildpacks:add --index 2 https://github.com/ryandotsmith/null-buildpack
```

In your environment variables on Heroku set the following variables to be 
credentials 

```
COUCHDB_USER=<admin>
COUCHDB_PASS=<password>
```