import assert from "node:assert/strict";
import test from "node:test";

import {
  isTrackerData,
  migrateTrackerData,
  priorityWeightedPercent,
} from "../app/tracker-data.ts";

const createdAt = "2026-08-15T00:00:00.000Z";

function legacyGoal(id, workload) {
  return {
    id,
    name: id,
    target: 1,
    unit: "session",
    cadence: "week",
    workload,
    color: "#123456",
    createdAt,
  };
}

test("migrates version 1 workload bands without changing goal IDs or logs", () => {
  const log = {
    id: "log-1",
    goalId: "goal-p1",
    date: "2026-08-15",
    value: 1,
    createdAt,
  };
  const migrated = migrateTrackerData({
    version: 1,
    goals: [
      legacyGoal("goal-p1", 40),
      legacyGoal("goal-p2", 25),
      legacyGoal("goal-p3", 10),
      legacyGoal("goal-p4", 9),
    ],
    logs: [log],
  });

  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.goals.map(({ id, priority }) => ({ id, priority })), [
    { id: "goal-p1", priority: "P1" },
    { id: "goal-p2", priority: "P2" },
    { id: "goal-p3", priority: "P3" },
    { id: "goal-p4", priority: "P4" },
  ]);
  assert.deepEqual(migrated.logs, [log]);
  assert.equal(isTrackerData(JSON.parse(JSON.stringify(migrated))), true);
});

test("normalizes P1–P4 weights and caps over-completion", () => {
  assert.equal(priorityWeightedPercent([
    { ratio: 1, priority: "P1" },
    { ratio: 0, priority: "P4" },
  ]), 80);
  assert.equal(priorityWeightedPercent([
    { ratio: 2, priority: "P1" },
    { ratio: 1, priority: "P4" },
  ]), 100);
  assert.equal(priorityWeightedPercent([]), 0);
});

test("accepts a JSON round trip of the current schema", () => {
  const current = {
    version: 2,
    goals: [{
      id: "goal-current",
      name: "Current goal",
      target: 3,
      unit: "sessions",
      cadence: "week",
      priority: "P3",
      color: "#abcdef",
      createdAt,
    }],
    logs: [],
  };

  assert.deepEqual(migrateTrackerData(JSON.parse(JSON.stringify(current))), current);
});
