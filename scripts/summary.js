function rsSummary() {
  const config = rs.config();
  return rs.status().members.map((m, i) => ({
    name: m.name,
    stateStr: m.stateStr,
    health: m.health,
    priority: config.members[i].priority
  }));
}
printjson(JSON.stringify(rsSummary(), null, 2));