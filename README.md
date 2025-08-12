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
# docker commit mongo0 my-mongo:latest
docker commit mongo0 andrewmorgan818/mongodb-replication-demo:latest
docker push andrewmorgan818/mongodb-replication-demo:latest

docker pull andrewmorgan818/mongodb-replication-demo:latest

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
1. Fetch the latest Docker image:
```bash
docker pull andrewmorgan818/mongodb-replication-demo
```
3. Install the **Dev Containers** **VS Code** extension

## To be done when there's a new version of the docker image

## On-site, before the demo
1. Start the containers from Docker Desktop
1. Connect a seperate terminal tab to each of the nodes:
```bash
docker exec -it mongo0 bash
docker exec -it mongo1 bash   
docker exec -it mongo2 bash   
docker exec -it analytics bash   
docker exec -it delayed bash   
docker exec -it app0 bash   
```
3. Start the `mongod` process on `mongo0`, `mongo1`, `mongo2`, `analytics`, and `delayed`:
```bash
mongod --config /etc/mongod.conf&
```
4. Connect VS Code to `app0`: 
  - Execute (`command-ctrl-p`) `Dev Containers: Attach to Running Container`:
  ![Dev Containers](images/dev-containers.png)
  - Connect to `app0`:
  ![app0](images/app0.png)

## Running the HA demo
### Setting the scene

1. From any node, connect the mongo shell (`mongosh`) and confirm that the replica set is up and running:

```bash
mongosh "mongodb://mongo0:27017,mongo1:27017,mongo2:27017/?authSource=admin&replicaSet=mongodb-repl-set"
```

```js
function rsSummary() {
  const config = rs.config();
  return rs.status().members.map((m, i) => ({
    name: m.name,
    stateStr: m.stateStr,
    health: m.health,
    priority: config.members[i].priority
  }));
}

rsSummary()
```

2. Show the demo app code in `/home/src/mongo-repl-test/app.js`
3. Run the demo app:
- From the VS Code terminal:
```bash
cd /home/src/mongo-repl-test
git pull # optional
npm install # optional
npm start
```
4. Observe the output from the app:
```bash
root@app0:/home/src/mongo-repl-test# npm start

> replica-set-tester@1.0.0 start
> node app.js

[2025-08-12T09:16:59.576Z] Current value: 1
[2025-08-12T09:17:00.068Z] Incremented
[2025-08-12T09:17:00.079Z] Current value: 2
[2025-08-12T09:17:00.576Z] Current value: 2
[2025-08-12T09:17:01.079Z] Current value: 2
[2025-08-12T09:17:01.074Z] Incremented
[2025-08-12T09:17:01.581Z] Current value: 3
[2025-08-12T09:17:02.083Z] Current value: 4
[2025-08-12T09:17:02.077Z] Incremented
...
```
### Failover when NICELY killing primary process
1. Make the app output visible, and observe the incrementing count
2. From the terminal for the node that's currently primary:
```bash
root@mongo1:/# ps -ef | grep mongod
root        18     1  1 09:22 ?        00:01:57 mongod --config /etc/mongod.conf
root       317   152  0 11:22 pts/2    00:00:00 grep mongod
root@mongo1:/# kill 18
```
3. Observe that the output from the app wasn't interrupted
4. From any node, run rsSummary():
```js
Enterprise mongodb-repl-set [primary] test> rsSummary()
[
  { 
    name: 'mongo0:27017', 
    stateStr: 'PRIMARY', 
    health: 1, 
    priority: 1 
  },
  {
    name: 'mongo1:27017',
    stateStr: '(not reachable/healthy)',
    health: 0,
    priority: 1
  },
  {
    name: 'mongo2:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  }
]
```
5. Note that a new node has taken over as primary
6. Start `mongod` on that node again: 
```bash
mongod --config /etc/mongod.conf&
```
7. Observe that the app output wasn't interrupted
8. Observe that the node has rejoined the cluster:
```js
rsSummary()
[
  { 
    name: 'mongo0:27017', 
    stateStr: 'PRIMARY',
    health: 1,
    priority: 1 
  },
  {
    name: 'mongo1:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  },
  {
    name: 'mongo2:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  }
]
```

### Failover when HARD killing primary process
1. Make the app output visible, and observe the incrementing count
2. From the terminal for the node that's currently primary:
```bash
root@mongo0:/# ps -ef | grep mongod
root        19    17  1 09:22 pts/1    00:02:14 mongod --config /etc/mongod.conf
root       348    17  0 11:35 pts/1    00:00:00 grep mongod
root@mongo0:/# kill -9 19
```
3. Observe that the output from the app halts for a few seconds and then continues from where it left off, there are no errors reported by the application
4. From any node, run rsSummary():
```js
rsSummary()
[
  {
    name: 'mongo0:27017',
    stateStr: '(not reachable/healthy)',
    health: 0,
    priority: 1
  },
  {
    name: 'mongo1:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  },
  { 
    name: 'mongo2:27017',
    stateStr: 'PRIMARY',
    health: 1,
    priority: 1 
  }
]
```
5. Note that a new node has taken over as primary
6. Start `mongod` on that node again: 
```bash
mongod --config /etc/mongod.conf&
```
7. Observe that the app output wasn't interrupted
8. Observe that the node has rejoined the cluster:
```js
rsSummary()
[
  {
    name: 'mongo0:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  },
  {
    name: 'mongo1:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  },
  { 
    name: 'mongo2:27017', 
    stateStr: 'PRIMARY', 
    health: 1, 
    priority: 1 
  }
]
```


config = rs.conf()
config.members[1].priority = 10 // mongo2
config.settings.electionTimeoutMillis = 1000;  // Lower to 1 second
rs.reconfig(config)

function rsSummary() {
  const config = rs.config();
  return rs.status().members.map((m, i) => ({
    name: m.name,
    stateStr: m.stateStr,
    health: m.health,
    priority: config.members[i].priority
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
