const { MongoClient } = require("mongodb");

const uri = "mongodb://billy:fish@mongo1:27017,mongo2:27017,mongo3:27017/?authSource=admin&replicaSet=mongodb-repl-set";
const client = new MongoClient(uri);

async function main() {
  await client.connect();

  const db = client.db("test");
  const col = db.collection("counter");

  // Ensure the document exists
  await col.updateOne({ _id: "counter" }, { $setOnInsert: { value: 0 } }, { upsert: true });

  // Increment thread
  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      await col.updateOne({ _id: "counter" }, { $inc: { value: 1 } });
      console.log(`[${now}] Incremented`);
    } catch (err) {
      console.error("Increment error:", err.message);
    }
  }, 1000);

  // Reader thread
  setInterval(async () => {
    try {
      const doc = await col.findOne({ _id: "counter" });
      const now = new Date().toISOString();
      console.log(`[${now}] Current value: ${doc?.value}`);
    } catch (err) {
      console.error("Read error:", err.message);
    }
  }, 1000);
}

main().catch(console.error);