// Idempotent replica set init
try {
  if (rs.status().ok === 1) {
    print("Replica set already initiated");
    quit(0);
  }
} catch (e) { /* not initiated yet */ }

print("Initiating replica set...");
rs.initiate({
  _id: "mongodb-repl-set",
  version: 1,
  members: [
    { _id: 0, host: "mongo0" },
    { _id: 1, host: "mongo1" },
    { _id: 2, host: "mongo2" }
  ]
});
print("Replica set initiated successfully");