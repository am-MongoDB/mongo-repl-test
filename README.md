# mongo-repl-test

```
docker network create mongo-net

docker run -dit --name analytics --hostname analytics --network mongo-net my-custom-mongo bash
<!-- docker run -dit --name delayed --hostname delayed --network mongo-net my-custom-mongo bash -->
docker run -dit --name mongo2 --hostname mongo2 --network mongo-net my-custom-mongo bash
docker run -dit --name 1 --hostname 1 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo0 --hostname mongo0 --network mongo-net my-custom-mongo bash
docker run -dit --name app1 --hostname app1 --network mongo-net my-custom-mongo bash

docker commit mongo0 my-mongo:latest

docker exec -it mongo1 bash

mongod --config /etc/mongod.conf&

rs.initiate(
  {
     _id: "mongodb-repl-set",
     version: 1,
     members: [
        { _id: 0, host : "mongo0" },
        { _id: 1, host : "mongo1" },
        { _id: 2, host : "mongo2" }
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

mongosh "mongodb://billy:fish@mongo0:27017,mongo1:27017,mongo2:27017/?authSource=admin&replicaSet=mongodb-repl-set"

config = rs.conf()
config.members[1].priority = 10 // mongo2
config.settings.electionTimeoutMillis = 1000;  // Lower to 1 second
rs.reconfig(config)

function rsSummary() {
  return rs.status().members.map(m => ({
    name: m.name,
    stateStr: m.stateStr,
    health: m.health
  }));
}

rsSummary()

docker network disconnect mongo-net mongo2
docker network connect mongo-net mongo2

db.counter.updateOne({}, {$set: {value: 0}})

use local
db.oplog.rs.find({ns: 'test.counter'}).sort({ts: -1}).limit(1)

docker commit app1 my-mongo-image

rs.printReplicationInfo()

rs.add({
  host: "analytics:27017",
  priority: 0,
  hidden: true,
  tags: { role: "analytics" }
});

<!-- rs.add({
  host: "delayed:27017",
  priority: 0,
  hidden: true,
  tags: { role: "delayed" },
  secondaryDelaySecs: 60
}); -->

rs.remove("analytics:27017");
rs.remove("delayed:27017");

readPreference: { mode: "secondary", tags: [{ role: "analytics" }] };
```
