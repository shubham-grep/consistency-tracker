export type Cadence = "day" | "week";
export type Priority = "P1" | "P2" | "P3" | "P4";

export type Goal = {
  id: string;
  name: string;
  target: number;
  unit: string;
  cadence: Cadence;
  priority: Priority;
  color: string;
  createdAt: string;
};

export type ProgressLog = {
  id: string;
  goalId: string;
  date: string;
  value: number;
  note?: string;
  createdAt: string;
};

export type TrackerData = {
  version: 2;
  goals: Goal[];
  logs: ProgressLog[];
};

type LegacyGoal = Omit<Goal, "priority"> & { workload: number };

type LegacyTrackerData = {
  version: 1;
  goals: LegacyGoal[];
  logs: ProgressLog[];
};

export const STORAGE_KEY = "steady-consistency-tracker-v2";
export const LEGACY_STORAGE_KEY = "steady-consistency-tracker-v1";
export const PRIORITY_WEIGHTS: Record<Priority, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };
export const PRIORITIES = Object.keys(PRIORITY_WEIGHTS) as Priority[];

function isProgressLog(value: unknown, goalIds: Set<string>): value is ProgressLog {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ProgressLog>;
  return typeof item.id === "string"
    && typeof item.goalId === "string"
    && goalIds.has(item.goalId)
    && typeof item.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && typeof item.value === "number"
    && item.value > 0
    && typeof item.createdAt === "string"
    && (item.note === undefined || typeof item.note === "string");
}

export function isTrackerData(value: unknown): value is TrackerData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackerData>;
  if (candidate.version !== 2 || !Array.isArray(candidate.goals) || !Array.isArray(candidate.logs)) {
    return false;
  }
  const validGoal = candidate.goals.every((goal) => {
    if (!goal || typeof goal !== "object") return false;
    const item = goal as Partial<Goal>;
    return typeof item.id === "string"
      && typeof item.name === "string"
      && typeof item.target === "number"
      && item.target > 0
      && typeof item.unit === "string"
      && (item.cadence === "day" || item.cadence === "week")
      && typeof item.priority === "string"
      && PRIORITIES.includes(item.priority as Priority)
      && typeof item.color === "string"
      && /^#[0-9a-f]{6}$/i.test(item.color)
      && typeof item.createdAt === "string";
  });
  const goalIds = new Set(candidate.goals.map((goal) => goal.id));
  return validGoal && candidate.logs.every((log) => isProgressLog(log, goalIds));
}

function isLegacyTrackerData(value: unknown): value is LegacyTrackerData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LegacyTrackerData>;
  if (candidate.version !== 1 || !Array.isArray(candidate.goals) || !Array.isArray(candidate.logs)) {
    return false;
  }
  const validGoal = candidate.goals.every((goal) => {
    if (!goal || typeof goal !== "object") return false;
    const item = goal as Partial<LegacyGoal>;
    return typeof item.id === "string"
      && typeof item.name === "string"
      && typeof item.target === "number"
      && item.target > 0
      && typeof item.unit === "string"
      && (item.cadence === "day" || item.cadence === "week")
      && typeof item.workload === "number"
      && item.workload >= 0
      && item.workload <= 100
      && typeof item.color === "string"
      && /^#[0-9a-f]{6}$/i.test(item.color)
      && typeof item.createdAt === "string";
  });
  const goalIds = new Set(candidate.goals.map((goal) => goal.id));
  return validGoal && candidate.logs.every((log) => isProgressLog(log, goalIds));
}

export function priorityFromWorkload(workload: number): Priority {
  if (workload >= 40) return "P1";
  if (workload >= 25) return "P2";
  if (workload >= 10) return "P3";
  return "P4";
}

export function migrateTrackerData(value: unknown): TrackerData | null {
  if (isTrackerData(value)) return value;
  if (!isLegacyTrackerData(value)) return null;
  return {
    version: 2,
    goals: value.goals.map(({ workload, ...goal }) => ({
      ...goal,
      priority: priorityFromWorkload(workload),
    })),
    logs: value.logs,
  };
}

export function priorityWeightedPercent(items: { ratio: number; priority: Priority }[]) {
  if (!items.length) return 0;
  const totalWeight = items.reduce((sum, item) => sum + PRIORITY_WEIGHTS[item.priority], 0);
  return Math.round(items.reduce(
    (sum, item) => sum + Math.min(Math.max(item.ratio, 0), 1) * PRIORITY_WEIGHTS[item.priority],
    0,
  ) / totalWeight * 100);
}
