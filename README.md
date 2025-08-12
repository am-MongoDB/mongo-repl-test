# mongo-repl-test

```bash
# Create network within Docker so that the apps running in the container can communicate with each other via hostname
docker network create mongo-net

docker run -dit --name analytics --hostname analytics --network mongo-net my-custom-mongo bash
# docker run -dit --name delayed --hostname delayed --network mongo-net my-custom-mongo bash
docker run -dit --name mongo2 --hostname mongo2 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo1 --hostname mongo1 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo0 --hostname mongo0 --network mongo-net my-custom-mongo bash
docker run -dit --name app0 --hostname app0 --network mongo-net my-custom-mongo bash

# Create or update the image based on container `mongo0`
docker commit mongo0 my-mongo:latest

# mongod --dbpath /var/lib/mongodb --noauth --logpath /var/log/mongodb/mongod.log --logappend --bind_ip 0.0.0.0 --replSet mongodb-repl-set&

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

```
## To be done once
1. Install **Docker Desktop** and request a **Docker** license from the Lumos app store (available via [corp.mongodb.com](https://corp.mongodb.com/))
2. Install the **Dev Containers** **VS Code** extension

## On-site, before the demo
1. Start the containers from Docker Desktop
2. Connect a seperate terminal tab to each of the nodes:
```bash
docker exec -it mongo0 bash
docker exec -it mongo1 bash   
docker exec -it mongo2 bash   
docker exec -it analytics bash   
docker exec -it delayed bash   
docker exec -it app0 bash   
```
3. Connect VS Code to `app0`: 

## Running the HA demo

1. From any node, connect the mongo shell (`mongosh`) and confirm that the replica set is up and running:

```bash
mongosh "mongodb://mongo0:27017,mongo1:27017,mongo2:27017/?authSource=admin&replicaSet=mongodb-repl-set"
```

```js
function rsSummary() {
  return rs.status().members.map(m => ({
    name: m.name,
    stateStr: m.stateStr,
    health: m.health
  }));
}

rsSummary()
```

2. Connect VS Code to `app0`:
- Execute (`command-ctrl-p`) `Dev Containers: Attach to Running Container`:
![Dev Containers](images/dev-containers.png)
- Connect to `app0`:
![app0](images/app0.png)
3. 
4. Run the demo app:
- From the VS Code terminal:
```bash
cd /home/src/mongo-repl-test
git pull # optional
npm install # optional
```

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

# Disconnect and then connect mongo2 to our Docker container
docker network disconnect mongo-net mongo2
docker network connect mongo-net mongo2

db.counter.updateOne({}, {$set: {value: 0}})

use local
db.oplog.rs.find({ns: 'test.counter'}).sort({ts: -1}).limit(1)

# Save the image based on this container
docker commit app1 my-mongo-image

rs.printReplicationInfo()

rs.add({
  host: "analytics:27017",
  priority: 0,
  hidden: true,
  tags: { role: "analytics" }
});

/***
  rs.add({
  host: "delayed:27017",
  priority: 0,
  hidden: true,
  tags: { role: "delayed" },
  secondaryDelaySecs: 60
}); 

***/

rs.remove("analytics:27017");
rs.remove("delayed:27017");

readPreference: { mode: "secondary", tags: [{ role: "analytics" }] };

db.collection.getIndexes();

```
