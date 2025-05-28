# mongo-repl-test

```
docker network create mongo-net

docker run -dit --name mongo1 --hostname mongo1 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo2 --hostname mongo2 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo3 --hostname mongo3 --network mongo-net my-custom-mongo bash
docker run -dit --name app1 --hostname app1 --network mongo-net my-custom-mongo bash

rs.initiate(
  {
     _id: "mongodb-repl-set",
     version: 1,
     members: [
        { _id: 0, host : "mongo1" },
        { _id: 1, host : "mongo2" },
        { _id: 2, host : "mongo3" }
     ]
  }
)

use admin

db.createUser({
   user: "billy",
   pwd: "fish",
   roles: [
     {role: "root", db: "admin"}
   ]
 })

mongosh "mongodb://billy:fish@mongo1:27017,mongo2:27017,mongo3:27017/?authSource=admin&replicaSet=mongodb-repl-set"
```
