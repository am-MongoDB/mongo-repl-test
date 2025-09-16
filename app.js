const { MongoClient, ReadPreference } = require("mongodb");


// ////////////////////////////////////////////////////////////////////////////
//
// The URI doesn't need to include all nodes in the replica set, so long as
// at least one (available node) is included  and the replica set name is
// specified then thereplica set will fill in the rest.
//
const uri = "mongodb://mongo0:27017,mongo1:27017,mongo2:27017/?authSource=admin&replicaSet=mongodb-repl-set";
// // DEMO 4
// const uri = "mongodb://mongo0:27017,mongo1:27017,mongo2:27017/?authSource=admin&replicaSet=mongodb-repl-set&readPreference=primaryPreferred";
//
// ////////////////////////////////////////////////////////////////////////////

const client = new MongoClient(uri);

// main():
// - Connects to the MongoDB replica set using the provided URI
// - Ensures a seed "counter" document exists
// - Starts a writer interval to increment the counter every second
// - Starts a reader interval to print the current value every 500ms
// - (Optional) contains a commented analytics reader for a tagged secondary

async function main() {
  await client.connect();
  const db = client.db("test");
  const col = db.collection("counter");
  await col.updateOne({ _id: "counter" }, { $setOnInsert: { value: 0 } }, { upsert: true });

  // //////////////////////////////////////////////////////////////////////////
  // Writer thread - Increments the counter every second
  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      await col.updateOne({ _id: "counter" }, { $inc: { value: 1 } });
      console.log(`[${now}] Incremented`);
    } catch (err) {
      console.error("Increment error:", err.message);
    }
  }, 1000);


  // //////////////////////////////////////////////////////////////////////////
  // // DEMO 4
  // const readCol = db.collection("counter");
  const readCol = db.collection("counter", { readPreference: ReadPreference.primaryPreferred });

  // //////////////////////////////////////////////////////////////////////////
  // Reader thread
  setInterval(async () => {
    try {
      const doc = await readCol.findOne({ _id: "counter" });
      const now = new Date().toISOString();
      console.log(`[${now}] Current value: ${doc?.value}`);
    } catch (err) {
      console.error("Read error:", err.message);
    }
  }, 500);

  // //////////////////////////////////////////////////////////////////////////
  // // DEMO 7
  // const analyticsCol = db.collection("counter", {
  //   readPreference: { mode: "secondary", tags: [{ role: "analytics" }] } });
  // // Analytics thread
  // setInterval(async () => {
  //   try {
  //     const doc = await analyticsCol.findOne({ _id: "counter" });
  //     const now = new Date().toISOString();
  //     console.log(`ANALYTICS: [${now}] Current value: ${doc?.value}`);
  //   } catch (err) {
  //     console.error("Read error:", err.message);
  //   }
  // }, 5000);

}

main().catch(console.error);