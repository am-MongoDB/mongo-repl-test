# MongoDB Failover and Effects

These scenarios highlight the different ways a MongoDB replica set can be stressed or reconfigured to demonstrate its high-availability behavior. You can see how the cluster responds when the primary is killed abruptly, how election rules allow a higher-priority node to regain leadership, and how using the `primaryPreferred` read preference keeps queries flowing during failover. Network isolation and container termination tests simulate real outages, while adding an analytics node or removing a member shows how the replica set can adapt to changing workloads. Together, they provide a practical tour of resilience, election dynamics, and scaling options.

## 1. Prequisites

- Install **Docker Desktop**. For MongoDB employees, request a **Docker** license from the Lumos app via [corp.mongodb.com](https://corp.mongodb.com/).

##  2. Docker Compose (Recommended)

### 2a. Setup Processes

In one terminal, start all up all the services and initiate the replica set:

```bash
# (terminal 1) Start all containers
$ docker compose up -d
[+] Running 5/5
 ✔ Container mongo1     Healthy
 ✔ Container mongo2     Healthy
 ✔ Container analytics  Healthy
 ✔ Container mongo0     Healthy
 ✔ Container app0       Started

# (terminal 1) Initiate the replica set
$ docker compose exec mongo0 bash
$ mongosh --file /scripts/init-rs.js
Initiating replica set...
Replica set initiated successfully
$ mongosh --file /scripts/summary.js
exit
```

Open and review the application code in the [app.js](./app.js) file. Explain the nature of the app. Ensure to cover the MongoClient, the read and write queries.


In **another** terminal, start the application process:

```bash
# (terminal 2) Start the app
$ docker compose exec app0 bash -c "npm start"
> replica-set-tester@1.0.0 start
> node app.js

[2025-08-27T14:51:23.515Z] Current value: 603
[2025-08-27T14:51:24.011Z] Incremented
[2025-08-27T14:51:24.018Z] Current value: 604
[2025-08-27T14:51:24.515Z] Current value: 604
```

Note, you'll come back and monitor the app terminal as you complete various demos.

### 2b. Run each demo

#### DEMO 1: Failover when NICELY killing `primary` process

Gracefully stopping the `primary` allows the replica set to detect the shutdown and quickly elect a new `primary`. Client applications continue with minimal or no interruption.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- Kill the primary:

  ```bash
  # (terminal 1)
  KILL_NODE=mongo0 # update this variable with the *current* primary
  $ docker compose exec ${KILL_NODE} bash
  $ mongosh --file scripts/summary.js # optional, re-confirm this is the primary
  $ ps -ef  # optional
  $ pidof mongod # optional
  $ kill $(pidof mongod)
  $ ps -ef  # optional, check is dead
  $ exit
  ```

- Observe the app wasn't interrupted in **terminal 2**.
- Check the replica set from a running node:

  ```bash
  # (terminal 1)
  RUNNING_NODE=mongo1  # update this variable with a running node
  $ docker compose exec ${RUNNING_NODE} mongosh --file scripts/summary.js
  ```

- Start the previously killed `mongod`:

  ```bash
  # (terminal 1)
  $ docker compose exec ${KILL_NODE} bash
  $ mongod --config /etc/mongod.conf --replSet mongodb-repl-set --fork

  # observe the node has rejoined the cluster
  $ mongosh --file scripts/summary.js
  $ exit
  ```

</details>


#### DEMO 2: Failover when HARD killing `primary` process

Using `kill -9` abruptly terminates the `primary` without cleanup, causing a slightly longer election. Applications pause briefly for writes but resume once a new `primary` is chosen.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- Kill the primary:

  ```bash
  # (terminal 1)
  KILL_NODE=mongo1 # update this variable with the *current* primary
  $ docker compose exec ${KILL_NODE} bash
  $ mongosh --file scripts/summary.js # optional, re-confirm this is the primary
  $ ps -ef  # optional
  $ pidof mongod # optional
  $ kill -9 $(pidof mongod)
  $ ps -ef  # optional, check is dead
  $ exit
  ```

- In **terminal 2**, observe that the output from the app halts for a few seconds and then continues from where it left off, there are no errors reported by the application. Note, the reads were also paused. This will be addressed in an upcoming demo.
- Check the replica set from a running node:

  ```bash
  # (terminal 1)
  RUNNING_NODE=mongo2  # update this variable with a running node
  $ docker compose exec ${RUNNING_NODE} mongosh --file scripts/summary.js
  ```

- Start the previously killed `mongod`:

  ```bash
  # (terminal 1)
  $ docker compose exec ${KILL_NODE} bash
  $ mongod --config /etc/mongod.conf --replSet mongodb-repl-set --fork

  # observe the node has rejoined the cluster
  $ mongosh --file scripts/summary.js
  $ exit
  ```
</details>


#### DEMO 3: Higher Priority Node becomes `primary`

By setting replica set priorities, a designated node can reclaim the `primary` role after it restarts. This ensures leadership is assigned to preferred infrastructure.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- Set `mongo2` to have a higher priority. Note we also reduce `electionTimeoutMillis` in demos to quickly show a new primary being elected. In prod, a very low number can trigger false elections more often, which can reduce stability. It determines how long should a `secondary` node wait to trigger an election because it assumes the `primary` is unreachable.

  ```bash
  # (terminal 1)
  $ P10_NODE=mongo2
  $ docker compose exec ${P10_NODE} bash
  $ mongosh ${MONGODB_URI} --quiet
  $   config = rs.conf();
  $   config.members[2].host; // optional, confirm this is mongo2
  $   config.members[2].priority = 10;
  $   config.settings.electionTimeoutMillis = 1000;  // Lower to 1 second
  $   rs.reconfig(config);
  $   exit;
  ```

- Observe that your `P10_NODE` has been elected to `primary`.
  ```bash
  # (terminal 1)
  $ docker compose exec ${P10_NODE} mongosh --file scripts/summary.js
  ```
- Kill the primary:
  ```bash
  # (terminal 1)
  $ docker compose exec ${P10_NODE} pkill -9 mongod
  ```

- In **terminal 2**, observe that the output from the app halts for a much shorter time compared the preceeding demo and then continues from where it left off, there are no errors reported by the application.

- Check the replica set from a running node:

  ```bash
  # (terminal 1)
  RUNNING_NODE=mongo0  # update this variable with a running node
  $ docker compose exec ${RUNNING_NODE} mongosh --file scripts/summary.js
  ```

- Start the previously killed `mongod`:

  ```bash
  # (terminal 1)
  $ docker compose exec ${P10_NODE} bash

  $ mongod --config /etc/mongod.conf --replSet mongodb-repl-set --fork


  # observe the node has rejoined the cluster as `primary`
  ```

- Set `electionTimeoutMillis` to 5 seconds:
  ```bash
  $ mongosh ${MONGODB_URI} --quiet
  $  config = rs.conf();
  $  config.settings.electionTimeoutMillis = 5000;
  $  rs.reconfig(config);
  $  exit
  $ exit
  ```

</details>

#### DEMO 4: Change the query options so that reads aren't delayed when the `primary` fails

In this demo we'll use a `primaryPreferred` [Read Preference](https://www.mongodb.com/docs/manual/core/read-preference/). With `primaryPreferred`, reads can fall back to secondaries during `primary` downtime. This keeps queries flowing even if writes are briefly blocked.

Note: The `primaryPreferred` option can be set at the connection string/driver level or on a per-query basis.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- In **terminal 2**, stop the application (`ctrl-c`)
- Edit [`app.js`](app.js) to include the `primaryPreferred` read preference:

  ```js
  const col = db.collection("counter", { readPreference: ReadPreference.primaryPreferred });
  ```

- Restart the application  `docker compose exec app0 bash -c "npm start"`
- Kill the `primary` `docker compose exec ${P10_NODE} pkill -9 mongod`
- Observe that the reads continue, but the counter is not incremented for a few seconds.
- Verify `P10_NODE` is unreachable.
  ```bash
   $ RUNNING_NODE=mongo0
   $ docker compose exec ${RUNNING_NODE} mongosh --file scripts/summary.js
- Restart mongod `docker compose exec ${P10_NODE} mongod --config /etc/mongod.conf --fork`
</details>

#### DEMO 5: Isolate the `primary` node from the network

Network isolation simulates a partition, triggering the remaining members to elect a new `primary`. Once reconnected, the isolated node rejoins as a `secondary`.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- `P10_NODE` should still be the `primary` as it has the highest priority; isolate it from the Docker network

  ```bash
  docker network disconnect mongo-net ${P10_NODE}
  ```

  You may spot a `Increment error: connect ECONNREFUSED 127.0.0.1:27017` Error on the app, that's expected.

- Confirm `P10_NODE` is not a functioning member of the replica set. It may take up to `electionTimeoutMillis` to see this change.

  ```bash
  $ RUNNING_NODE=mongo0 # update accordingly
  $ docker compose exec ${RUNNING_NODE} mongosh --file scripts/summary.js
  $ docker compose exec ${P10_NODE} mongosh --file scripts/summary.js
  ```

- Confirm writes are rejected on `P10_NODE`

  ```bash
  $ docker compose exec ${P10_NODE} mongosh --eval "db.fluff.insertOne({})"
  MongoServerError: not primary
  ```

- Add `P10_NODE` back to the network `docker network connect mongo-net ${P10_NODE}`
- Confirm `P10_NODE` is reelected to be `primary`

  ```bash
  docker compose exec ${P10_NODE} mongosh --file scripts/summary.js
  ```

</details>

#### DEMO 6: Kill the docker container

Force-killing the `primary` MongoDB container simulates a crash, causing failover and re-election. The application may see a short write pause before resuming.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- Kill the `P10_NODE` container `docker compose kill ${P10_NODE}`
- Note from the app output that writes are paused during the failover/election.
- Restart the container `docker compose restart ${P10_NODE}`
- Restart mongod `docker compose exec ${P10_NODE} mongod --config /etc/mongod.conf --fork`
- Observe that `P10_NODE` rejoins the replica set && is reelected primary

  ```bash
  $ docker compose exec ${P10_NODE} mongosh --file scripts/summary.js
  ```

</details>

#### DEMO 7: Add an analytics node (if not using Atlas)

Adding an analytics node with `priority 0` and role tags routes reporting or BI workloads to it, offloading queries from the main replica set. This improves performance for operational traffic.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>

- Add the `analytics` node to the replica set

  ```bash
  $ docker compose exec ${P10_NODE} mongosh ${MONGODB_URI} --quiet
    rs.add({
      host: "analytics:27017",
      priority: 0, // can never be primary
      tags: { role: "analytics" }
    });
  $ exit
  ```

- Uncomment the analytics thread code (DEMO 7) in [`app.js`](/app.js)
- Restart the app

</details>

#### DEMO 8: Remove a node

Removing a member reduces fault tolerance but keeps the replica set functional if a majority remains. It’s useful for scaling down or node maintenance.

<details>
<summary>🎬🎬🎬 Click to expand the section and see the commands. </summary>\

  ```bash
  $ docker compose exec mongo0
  $ mongosh ${MONGODB_URI}
    rs.remove("analytics:27017");
  $ exit
  ```

</details>

## 2. Docker (Alternative)

### 2a. Create a Docker network:

```bash
docker network create mongo-net
```

### To be done first time or whenever there's a new version of the docker image

1. Delete any existing containers and images for this demo
1. Fetch the latest Docker image:

```bash
docker pull andrewmorgan818/mongodb-replication-demo:latest
```

3. Create the containers and connect them to our Docker network

```bash
docker run -dit \
  --name mongo0 \
  --hostname mongo0 \
  --network mongo-net \
  andrewmorgan818/mongodb-replication-demo bash
```
```bash
docker run -dit \
  --name mongo1 \
  --hostname mongo1 \
  --network mongo-net \
  andrewmorgan818/mongodb-replication-demo bash
```
```bash
docker run -dit \
  --name mongo2 \
  --hostname mongo2 \
  --network mongo-net \
  andrewmorgan818/mongodb-replication-demo bash
```
```bash
docker run -dit \
  --name analytics \
  --hostname analytics \
  --network mongo-net \
  andrewmorgan818/mongodb-replication-demo bash
```
```bash
docker run -dit \
  --name app0 \
  --hostname app0 \
  --network mongo-net andrewmorgan818/mongodb-replication-demo bash
```
### On-site, before the demo

1. Start the containers from Docker Desktop
1. Connect a seperate terminal tab to each of the nodes:

```bash
docker exec -it mongo0 bash
```
```bash
docker exec -it mongo1 bash
```
```bash
docker exec -it mongo2 bash
```
```bash
docker exec -it analytics bash
```
```bash
docker exec -it app0 bash
```

3. Start the `mongod` process on `mongo0`, `mongo1`, `mongo2`, and `analytics`:

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

1. On `mongo0`, initiate the replica set:

```bash
mongosh
```

```js
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

quit
```

1. Confirm that the replica set is up and running:

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

1. Show the demo app code in `/home/src/mongo-repl-test/app.js`
1. Run the demo app:
- From the VS Code terminal:

```bash
cd /home/src/mongo-repl-test
git pull # optional
npm install # optional
npm start
```

5. Observe the output from the app:

```bash
npm start
```
```bash
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
2. From the terminal for the node that's currently `PRIMARY`:

```bash
root@mongo1:/# ps -ef | grep mongod
root        18     1  1 09:22 ?        00:01:57 mongod --config /etc/mongod.conf
root       317   152  0 11:22 pts/2    00:00:00 grep mongod
```
```bash
root@mongo1:/# kill 18
```

3. Observe that the output from the app wasn't interrupted
4. From any **other** node, run rsSummary():

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
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

</details>

5. Note that a new node has taken over as primary
6. Start `mongod` on that node again:

```bash
mongod --config /etc/mongod.conf&
```

7. Observe that the app output wasn't interrupted
8. Observe that the node has rejoined the cluster:

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
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

</details>

### Failover when HARD killing primary process

1. Make the app output visible, and observe the incrementing count
2. From the terminal for the node that's currently primary:

```bash
ps -ef | grep mongod
```
```bash
root        19    17  1 09:22 pts/1    00:02:14 mongod --config /etc/mongod.conf
root       348    17  0 11:35 pts/1    00:00:00 grep mongod
```
```bash
kill -9 19
```

3. Observe that the output from the app halts for a few seconds and then continues from where it left off, there are no errors reported by the application
4. From any node, run rsSummary():

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
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

</details>

5. Note that a new node has taken over as primary
6. Start `mongod` on that node again:

```bash
mongod --config /etc/mongod.conf&
```

7. Observe that the app output wasn't interrupted
8. Observe that the node has rejoined the cluster:

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
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

</details>

### Show original primary with higher priority is elected back to be primary after failing and restarting

1. Set `mongo1` to have a higher priority than the other nodes (from `mongosh`), and also reduce the timeout for failover:

```js
config = rs.conf()
config.members[1].priority = 10 // mongo1
config.settings.electionTimeoutMillis = 1000;  // Lower to 1 second
rs.reconfig(config)
```

2. Observe that `mongo1` has been elected to primary and now has a higher priority than the other nodes:

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
[
  {
    name: 'mongo0:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  },
  {
    name: 'mongo1:27017',
    stateStr: 'PRIMARY',
    health: 1,
    priority: 10
  },
  {
    name: 'mongo2:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  }
]
```

</details>

3. `kill -9` `mongod` on `mongo1` and notice that the app doesn't pause for as long as before
4. Restart `mongod` on `mongo1`
5. From `mongosh`, confirm that `mongo1` has rejoined the replica set and been reelected to primary

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
[
  {
    name: 'mongo0:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  },
  {
    name: 'mongo1:27017',
    stateStr: 'PRIMARY',
    health: 1,
    priority: 10
  },
  {
    name: 'mongo2:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  }
]
```

</details>

6. Set the timeout to 5 seconds:

```js
config = rs.conf()
config.settings.electionTimeoutMillis = 5000;  // Increase to 5 seconds
rs.reconfig(config)
```

### Change the connection string so that reads aren't delayed when primary fails

1. Stop the application (`ctrl-c`)
2. Edit `app.js` to include the `primaryPreferred` read preference:

```js
const readCol = db.collection("counter", { readPreference: ReadPreference.primaryPreferred });
```

3. Restart the application (`npm start`)
4. `kill -9` the primary `mongod`
5. Observe that the reads continue, but the counter is not incremented for a few seconds:


<details>
<summary> Click to expand example outuput </summary>

```js
[2025-08-12T11:57:34.583Z] Current value: 2408
[2025-08-12T11:57:34.867Z] Incremented
[2025-08-12T11:57:35.083Z] Current value: 2409
[2025-08-12T11:57:35.587Z] Current value: 2409
[2025-08-12T11:57:36.095Z] Current value: 2409
[2025-08-12T11:57:36.601Z] Current value: 2409
[2025-08-12T11:57:37.104Z] Current value: 2409
[2025-08-12T11:57:37.604Z] Current value: 2409
[2025-08-12T11:57:38.107Z] Current value: 2409
[2025-08-12T11:57:38.610Z] Current value: 2409
[2025-08-12T11:57:39.115Z] Current value: 2409
[2025-08-12T11:57:39.615Z] Current value: 2409
[2025-08-12T11:57:40.116Z] Current value: 2409
[2025-08-12T11:57:40.619Z] Current value: 2409
[2025-08-12T11:57:35.869Z] Incremented
[2025-08-12T11:57:37.877Z] Incremented
[2025-08-12T11:57:36.872Z] Incremented
[2025-08-12T11:57:38.881Z] Incremented
[2025-08-12T11:57:39.882Z] Incremented
[2025-08-12T11:57:40.886Z] Incremented
[2025-08-12T11:57:41.120Z] Current value: 2415
```

</details>

6. Restart `mongod` on `mongo1`

## Isolate the primary node from the network

1. `mongo1` should still be the primary as it has the highest priority; isolate it from the Docker network:

```bash
docker network disconnect mongo-net mongo1
```

2. Confirm that `mongo1` is not a functioning member of the replica set:

```js
rsSummary()
```

<details>
<summary> Click to expand example outuput </summary>

```js
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
    priority: 10
  },
  {
    name: 'mongo2:27017',
    stateStr: 'SECONDARY',
    health: 1,
    priority: 1
  }
]
```

<details>

3. Try connecting `mongosh` to the replica set with only `mongo1` in the connection string:

```bash
mongosh "mongodb://mongo1:27017/?authSource=admin&replicaSet=mongodb-repl-set"
```

```js
mongosh "mongodb://mongo1:27017/?authSource=admin&replicaSet=mongodb-repl-set"
```
```js
Current Mongosh Log ID:	689b30d9f67c0664e8d2950c
Connecting to:		mongodb://mongo1:27017/?authSource=admin&replicaSet=mongodb-repl-set&appName=mongosh+2.5.1
MongoServerSelectionError: getaddrinfo EAI_AGAIN mongo1
```

4. Check if the process has been stopped on mongo1:

```js
ps -ef | grep mongod
```
```js
root      1726  1636  0 11:21 pts/2    00:00:00 grep mongod
```

5. If the `mongod` process is still running, connect to `mongo1` using `mongosh` and confirm that it rejects writes:

```bash
root@mongo1:/# mongosh
```
```js
db.fluff.insertOne({})
```
```js
MongoServerError[NotWritablePrimary]: not primary
````

6. Add `mongo1` back to the network:

```bash
docker network connect mongo-net mongo1
```

7. Confirm that `mongo1` is reelected to be primary

### Kill (rather than gracefully stoping) the docker container

1. Kill the `mongo1` container:

```bash
docker kill mongo1
```

2. Note from the app output that writes are paused during the failover/election
3. Restart the container
4. Restart `mongod`
5. Observe from `mongosh` that `mongo1` rejoins the replica set and is reelected primary

### Add an analytics node (if not using Atlas)

1. If not already running, start `mongod` on `analytics`
2. Add the node to the replica set (from `mongosh`):

```js
rs.add({
  host: "analytics:27017",
  priority: 0,
  tags: { role: "analytics" }
});
```

3. Uncomment the analytics thread in `app.js` and restart the app:

```js
const analyticsCol = db.collection("counter", {
  readPreference: { mode: "secondary", tags: [{ role: "analytics" }] } });

// Analytics thread
setInterval(async () => {
  try {
    const doc = await analyticsCol.findOne({ _id: "counter" });
    const now = new Date().toISOString();
    console.log(`ANALYTICS: [${now}] Current value: ${doc?.value}`);
  } catch (err) {
    console.error("Read error:", err.message);
  }
}, 5000);
```

## Remove a node

1. Remove the analytics node and show that the application continues running:

```js
rs.remove("analytics:27017");
```

## (Optional) Save and publish the image based on one of these containers

```bash
docker commit app0 andrewmorgan818/mongodb-replication-demo
docker push andrewmorgan818/mongodb-replication-demo:latest
```
