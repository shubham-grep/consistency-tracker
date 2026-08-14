"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Cadence = "day" | "week";

type Goal = {
  id: string;
  name: string;
  target: number;
  unit: string;
  cadence: Cadence;
  workload: number;
  color: string;
  createdAt: string;
};

type ProgressLog = {
  id: string;
  goalId: string;
  date: string;
  value: number;
  note?: string;
  createdAt: string;
};

type TrackerData = {
  version: 1;
  goals: Goal[];
  logs: ProgressLog[];
};

type GoalDraft = {
  name: string;
  target: string;
  unit: string;
  cadence: Cadence;
  workload: string;
  color: string;
};

type BadgeState = {
  id: string;
  mark: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: string;
};

const STORAGE_KEY = "steady-consistency-tracker-v1";
const DAY_MS = 86_400_000;
const GOAL_COLORS = ["#e7ad2f", "#df6c51", "#55735e", "#7786b8", "#ad7057"];

const emptyGoal: GoalDraft = {
  name: "",
  target: "3",
  unit: "sessions",
  cadence: "week",
  workload: "25",
  color: GOAL_COLORS[0],
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const distance = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - distance);
  next.setHours(12, 0, 0, 0);
  return next;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string, style: "short" | "long" = "long") {
  return new Intl.DateTimeFormat("en-US", {
    month: style === "short" ? "short" : "long",
    day: "numeric",
    year: style === "long" ? "numeric" : undefined,
  }).format(fromDateKey(value));
}

function makeId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function weeklyTarget(goal: Goal) {
  return goal.cadence === "day" ? goal.target * 7 : goal.target;
}

function quickAmount(goal: Goal) {
  const unit = goal.unit.toLowerCase();
  if (unit.includes("minute")) return 30;
  if (unit.includes("page")) return 20;
  if (unit.includes("hour")) return 1;
  if (unit.includes("percent") || unit === "%") return 10;
  return 1;
}

function createStarterData(): TrackerData {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const createdAt = new Date().toISOString();
  const goals: Goal[] = [
    {
      id: "goal-deep-work",
      name: "Deep work",
      target: 10,
      unit: "hours",
      cadence: "week",
      workload: 45,
      color: "#e7ad2f",
      createdAt,
    },
    {
      id: "goal-run",
      name: "Run",
      target: 3,
      unit: "sessions",
      cadence: "week",
      workload: 25,
      color: "#df6c51",
      createdAt,
    },
    {
      id: "goal-read",
      name: "Read",
      target: 20,
      unit: "pages",
      cadence: "day",
      workload: 30,
      color: "#55735e",
      createdAt,
    },
  ];
  const logs: ProgressLog[] = [];
  const pushLog = (goalId: string, date: Date, value: number, note?: string) => {
    logs.push({
      id: `seed-${goalId}-${dateKey(date)}-${logs.length}`,
      goalId,
      date: dateKey(date),
      value,
      note,
      createdAt,
    });
  };

  // A useful first-run history: an 18-day streak, a quiet break, then a varied archive.
  for (let offset = 0; offset < 18; offset += 1) {
    const day = addDays(today, -offset);
    pushLog("goal-read", day, offset % 4 === 0 ? 30 : 20);
    if (offset % 2 === 0) pushLog("goal-deep-work", day, 1);
    if (offset % 6 === 2) pushLog("goal-run", day, 1);
  }
  for (let offset = 19; offset < 190; offset += 1) {
    const day = addDays(today, -offset);
    const signal = (offset * 13 + Math.floor(offset / 7) * 5) % 17;
    if (signal < 10) pushLog("goal-read", day, signal % 3 === 0 ? 30 : 20);
    if (signal === 2 || signal === 5 || signal === 8) pushLog("goal-deep-work", day, 1.5);
    if (signal === 1 || signal === 9) pushLog("goal-run", day, 1);
  }

  return { version: 1, goals, logs };
}

function isTrackerData(value: unknown): value is TrackerData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackerData>;
  if (candidate.version !== 1 || !Array.isArray(candidate.goals) || !Array.isArray(candidate.logs)) {
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
      && typeof item.workload === "number"
      && item.workload >= 0
      && item.workload <= 100
      && typeof item.color === "string"
      && /^#[0-9a-f]{6}$/i.test(item.color)
      && typeof item.createdAt === "string";
  });
  const goalIds = new Set(candidate.goals.map((goal) => goal.id));
  const validLogs = candidate.logs.every((log) => {
    if (!log || typeof log !== "object") return false;
    const item = log as Partial<ProgressLog>;
    return typeof item.id === "string"
      && typeof item.goalId === "string"
      && goalIds.has(item.goalId)
      && typeof item.date === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
      && typeof item.value === "number"
      && item.value > 0
      && typeof item.createdAt === "string"
      && (item.note === undefined || typeof item.note === "string");
  });
  return validGoal && validLogs;
}

function activityDates(data: TrackerData) {
  return new Set(data.logs.filter((log) => log.value > 0).map((log) => log.date));
}

function streakStats(data: TrackerData, today: Date) {
  const active = activityDates(data);
  let cursor = new Date(today);
  if (!active.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let current = 0;
  while (active.has(dateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const date = fromDateKey(key);
    run = previous && Math.round((date.getTime() - previous.getTime()) / DAY_MS) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return { current, longest, activeDays: active.size };
}

function getWeekProgress(data: TrackerData, today: Date) {
  const start = dateKey(startOfWeek(today));
  const end = dateKey(addDays(startOfWeek(today), 6));
  return data.goals.map((goal) => {
    const value = data.logs
      .filter((log) => log.goalId === goal.id && log.date >= start && log.date <= end)
      .reduce((sum, log) => sum + log.value, 0);
    const target = weeklyTarget(goal);
    return { goal, value, target, ratio: target ? value / target : 0 };
  });
}

function overallWeekPercent(data: TrackerData, today: Date) {
  const progress = getWeekProgress(data, today);
  const weight = progress.reduce((sum, item) => sum + item.goal.workload, 0);
  if (!progress.length) return 0;
  if (!weight) {
    return Math.round((progress.reduce((sum, item) => sum + Math.min(item.ratio, 1), 0) / progress.length) * 100);
  }
  return Math.round(progress.reduce(
    (sum, item) => sum + Math.min(item.ratio, 1) * item.goal.workload,
    0,
  ) / weight * 100);
}

function getBadges(data: TrackerData, today: Date): BadgeState[] {
  const streaks = streakStats(data, today);
  const weekly = overallWeekPercent(data, today);
  const totalLogs = data.logs.length;
  return [
    {
      id: "first-step",
      mark: "01",
      name: "First Step",
      description: "Log your first check-in",
      unlocked: totalLogs >= 1,
      progress: `${Math.min(totalLogs, 1)} / 1`,
    },
    {
      id: "seven-strong",
      mark: "07",
      name: "Seven Strong",
      description: "Build a 7-day streak",
      unlocked: streaks.longest >= 7,
      progress: `${Math.min(streaks.longest, 7)} / 7 days`,
    },
    {
      id: "century-club",
      mark: "100",
      name: "Century Club",
      description: "Record 100 check-ins",
      unlocked: totalLogs >= 100,
      progress: `${Math.min(totalLogs, 100)} / 100`,
    },
    {
      id: "rhythm-keeper",
      mark: "30",
      name: "30-day Rhythm",
      description: "Build a 30-day streak",
      unlocked: streaks.longest >= 30,
      progress: `${Math.min(streaks.longest, 30)} / 30 days`,
    },
    {
      id: "week-won",
      mark: "✓",
      name: "Week Won",
      description: "Reach every weighted weekly target",
      unlocked: weekly >= 100,
      progress: `${Math.min(weekly, 100)}% / 100%`,
    },
    {
      id: "year-in-motion",
      mark: "365",
      name: "Year in Motion",
      description: "Show up on 365 different days",
      unlocked: streaks.activeDays >= 365,
      progress: `${Math.min(streaks.activeDays, 365)} / 365 days`,
    },
  ];
}

function greeting() {
  return "Consisteny + High Spikes = Success";  
}

<><p></p></>

export default function Home() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(emptyGoal);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [loggingGoalId, setLoggingGoalId] = useState("");
  const [logDate, setLogDate] = useState("");
  const [logValue, setLogValue] = useState("1");
  const [logNote, setLogNote] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const heatmapScrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    return value;
  }, []);
  const todayKey = dateKey(today);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isTrackerData(parsed)) {
          setData(parsed);
          setSelectedDate(todayKey);
          return;
        }
      }
    } catch {
      // A malformed local backup should never prevent the app from opening.
    }
    const starter = createStarterData();
    setData(starter);
    setSelectedDate(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (!data) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setGoalDialogOpen(false);
      setLogDialogOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const scroller = heatmapScrollRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [data]);

  const derived = useMemo(() => {
    if (!data) return null;
    const weekProgress = getWeekProgress(data, today);
    const streaks = streakStats(data, today);
    const badges = getBadges(data, today);
    const totalWorkload = data.goals.reduce((sum, goal) => sum + goal.workload, 0);
    const logsByDate = new Map<string, ProgressLog[]>();
    data.logs.forEach((log) => logsByDate.set(log.date, [...(logsByDate.get(log.date) ?? []), log]));

    const calendarStart = addDays(today, -today.getDay() - 52 * 7);
    const calendarDays = Array.from({ length: 371 }, (_, index) => addDays(calendarStart, index));
    const monthLabels = Array.from({ length: 53 }, (_, week) => {
      const start = addDays(calendarStart, week * 7);
      const previous = addDays(start, -7);
      if (week === 0 || start.getMonth() !== previous.getMonth()) {
        return new Intl.DateTimeFormat("en-US", { month: "short" }).format(start);
      }
      return "";
    });
    return {
      weekProgress,
      streaks,
      badges,
      totalWorkload,
      logsByDate,
      calendarDays,
      monthLabels,
      weeklyPercent: overallWeekPercent(data, today),
    };
  }, [data, today]);

  if (!data || !derived) {
    return (
      <main className="app-loading" aria-live="polite">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <p>Opening your rhythm…</p>
      </main>
    );
  }

  const openNewGoal = () => {
    setEditingGoalId(null);
    setGoalDraft({ ...emptyGoal, color: GOAL_COLORS[data.goals.length % GOAL_COLORS.length] });
    setGoalDialogOpen(true);
  };

  const openEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setGoalDraft({
      name: goal.name,
      target: String(goal.target),
      unit: goal.unit,
      cadence: goal.cadence,
      workload: String(goal.workload),
      color: goal.color,
    });
    setGoalDialogOpen(true);
  };

  const saveGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = Number(goalDraft.target);
    const workload = Number(goalDraft.workload);
    if (!goalDraft.name.trim() || !goalDraft.unit.trim() || target <= 0 || workload < 0 || workload > 100) {
      setToast("Check the goal name, target, unit, and workload share.");
      return;
    }
    if (editingGoalId) {
      setData({
        ...data,
        goals: data.goals.map((goal) => goal.id === editingGoalId ? {
          ...goal,
          name: goalDraft.name.trim(),
          target,
          unit: goalDraft.unit.trim(),
          cadence: goalDraft.cadence,
          workload,
          color: goalDraft.color,
        } : goal),
      });
      setToast("Goal updated.");
    } else {
      setData({
        ...data,
        goals: [...data.goals, {
          id: makeId("goal"),
          name: goalDraft.name.trim(),
          target,
          unit: goalDraft.unit.trim(),
          cadence: goalDraft.cadence,
          workload,
          color: goalDraft.color,
          createdAt: new Date().toISOString(),
        }],
      });
      setToast("Goal added. Your next check-in is ready.");
    }
    setGoalDialogOpen(false);
  };

  const deleteGoal = () => {
    if (!editingGoalId) return;
    const goal = data.goals.find((item) => item.id === editingGoalId);
    if (!goal || !window.confirm(`Delete “${goal.name}” and all of its check-ins?`)) return;
    setData({
      ...data,
      goals: data.goals.filter((item) => item.id !== editingGoalId),
      logs: data.logs.filter((log) => log.goalId !== editingGoalId),
    });
    setGoalDialogOpen(false);
    setToast("Goal and its check-ins deleted.");
  };

  const openLog = (goal: Goal, forDate = todayKey) => {
    setLoggingGoalId(goal.id);
    setLogDate(forDate);
    setLogValue(String(quickAmount(goal)));
    setLogNote("");
    setLogDialogOpen(true);
  };

  const saveLog = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const goal = data.goals.find((item) => item.id === loggingGoalId);
    const value = Number(logValue);
    if (!goal || value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      setToast("Choose a goal, date, and positive amount.");
      return;
    }
    const before = new Set(getBadges(data, today).filter((badge) => badge.unlocked).map((badge) => badge.id));
    const next: TrackerData = {
      ...data,
      logs: [...data.logs, {
        id: makeId("log"),
        goalId: goal.id,
        date: logDate,
        value,
        note: logNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      }],
    };
    const newlyUnlocked = getBadges(next, today).find((badge) => badge.unlocked && !before.has(badge.id));
    setData(next);
    setSelectedDate(logDate);
    setLogDialogOpen(false);
    setToast(newlyUnlocked ? `Badge unlocked: ${newlyUnlocked.name}!` : `${goal.name} logged for ${formatDate(logDate, "short")}.`);
  };

  const removeLog = (id: string) => {
    setData({ ...data, logs: data.logs.filter((log) => log.id !== id) });
    setToast("Check-in removed.");
  };

  const exportData = () => {
    const backup = {
      app: "Steady",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `steady-backup-${todayKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("JSON backup downloaded.");
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const payload = parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as { data: unknown }).data
        : parsed;
      if (!isTrackerData(payload)) throw new Error("invalid backup");
      if (!window.confirm("Replace the progress stored on this device with this backup?")) return;
      setData(payload);
      setSelectedDate(todayKey);
      setToast("Backup restored successfully.");
    } catch {
      setToast("That file is not a valid Steady backup.");
    }
  };

  const selectedLogs = (derived.logsByDate.get(selectedDate) ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const todayLogs = derived.logsByDate.get(todayKey) ?? [];
  const todayGoalIds = new Set(todayLogs.map((log) => log.goalId));
  const unlockedCount = derived.badges.filter((badge) => badge.unlocked).length;
  const totalContributions = derived.logsByDate.size;

  return (
    <main className="steady-app">
      <div className="page-shell">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Steady home">
            
            <span>Consistency Tracker</span>
          </a>
          <div className="top-actions">
            <span className="local-status"><i /> Saved locally</span>
            <input
              ref={importRef}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={importData}
              aria-label="Import Steady JSON backup"
            />
            <button className="button button-quiet" type="button" onClick={() => importRef.current?.click()}>
              Import
            </button>
            <button className="button button-quiet hide-mobile" type="button" onClick={exportData}>
              Export JSON
            </button>
            <button className="button button-primary" type="button" onClick={openNewGoal}>
              <span aria-hidden="true">＋</span> Add goal
            </button>
          </div>
        </header>

        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">{greeting()} · {formatDate(todayKey, "short")}</p>
            {/* <h1>Small steps,<br /><em>visible momentum.</em></h1> */}
            {/* <p className="hero-subtitle">Your quiet record of showing up—one honest check-in at a time.</p> */}
          </div>
  
        </section>

        <section className="metrics-strip" aria-label="Consistency summary">
          <article className="metric">
            <strong>{derived.streaks.current} <span>day</span></strong>
            <p>Current streak</p>
          </article>
          <article className="metric">
            <strong>{derived.weeklyPercent}<span>%</span></strong>
            <p>Weighted weekly target</p>
          </article>
       
     
        </section>

        <section className="dashboard-grid">
          <article className="card calendar-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Your year in practice</p>
                <h2>Consistency calendar</h2>
                <p>Each square is a day you chose to show up.</p>
              </div>
              <div className="calendar-total">
                <strong>{totalContributions}</strong>
                <span>active days</span>
              </div>
            </div>

            <div className="heatmap-scroll" ref={heatmapScrollRef}>
              <div className="heatmap-frame">
                <div className="month-spacer" />
                <div className="month-labels" aria-hidden="true">
                  {derived.monthLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
                </div>
                <div className="weekday-labels" aria-hidden="true">
                  <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
                </div>
                <div className="heatmap" role="grid" aria-label="Contribution activity over the last 12 months">
                  {derived.calendarDays.map((day) => {
                    const key = dateKey(day);
                    const count = derived.logsByDate.get(key)?.length ?? 0;
                    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;
                    const isFuture = day > today;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="gridcell"
                        className={`heat-cell level-${isFuture ? 0 : level}${selectedDate === key ? " is-selected" : ""}${isFuture ? " is-future" : ""}`}
                        aria-label={`${formatDate(key)}: ${count} ${count === 1 ? "check-in" : "check-ins"}`}
                        aria-selected={selectedDate === key}
                        disabled={isFuture}
                        onClick={() => setSelectedDate(key)}
                      >
                        <span className="heat-tooltip">{formatDate(key, "short")} · {count || "No"} {count === 1 ? "check-in" : "check-ins"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="calendar-footer">
              <p><strong>{derived.streaks.longest} days</strong> is your longest streak so far.</p>
              <div className="legend" aria-label="Contribution intensity from less to more">
                <span>Less</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>More</span>
              </div>
            </div>

            <div className="day-detail">
              <div>
                <span className="day-detail-label">Selected day</span>
                <h3>{selectedDate ? formatDate(selectedDate) : "Choose a day"}</h3>
              </div>
              <div className="day-entries">
                {selectedLogs.length ? selectedLogs.map((log) => {
                  const goal = data.goals.find((item) => item.id === log.goalId);
                  if (!goal) return null;
                  return (
                    <div className="day-entry" key={log.id}>
                      <span className="goal-dot" style={{ "--goal-color": goal.color } as CSSProperties} />
                      <span><strong>{goal.name}</strong>{log.note ? ` · ${log.note}` : ""}</span>
                      <b>{formatNumber(log.value)} {goal.unit}</b>
                      <button type="button" onClick={() => removeLog(log.id)} aria-label={`Remove ${goal.name} check-in`}>Remove</button>
                    </div>
                  );
                }) : <p className="empty-copy">No check-ins on this day yet.</p>}
              </div>
              {data.goals.length > 0 && selectedDate <= todayKey && (
                <button className="button button-small" type="button" onClick={() => openLog(data.goals[0], selectedDate)}>
                  Add entry
                </button>
              )}
            </div>
          </article>

          <aside className="card today-card">
            <div className="date-stamp" aria-label={formatDate(todayKey)}>
              <strong>{today.getDate()}</strong>
              <span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(today)}</span>
            </div>
            <p className="section-kicker">Today’s check-in</p>
            <h2>Keep the promise.</h2>
            <p className="today-intro">A small mark is enough. Choose a goal and record what actually happened.</p>
            <div className="today-progress">
              <span>{todayGoalIds.size} of {data.goals.length} goals touched today</span>
              <div><i style={{ width: `${data.goals.length ? Math.min(todayGoalIds.size / data.goals.length * 100, 100) : 0}%` }} /></div>
            </div>
            <div className="today-goals">
              {data.goals.map((goal) => {
                const amount = todayLogs.filter((log) => log.goalId === goal.id).reduce((sum, log) => sum + log.value, 0);
                return (
                  <div className="today-goal" key={goal.id}>
                    <span className="goal-dot" style={{ "--goal-color": goal.color } as CSSProperties} />
                    <div><strong>{goal.name}</strong><small>{amount ? `${formatNumber(amount)} ${goal.unit} logged` : "Ready when you are"}</small></div>
                    <button type="button" onClick={() => openLog(goal)}>{amount ? "Add" : "Log"}</button>
                  </div>
                );
              })}
              {!data.goals.length && <p className="empty-copy">Add your first goal to begin.</p>}
            </div>
            <p className="privacy-note"><span aria-hidden="true">●</span> Nothing leaves this browser. Your progress is private by design.</p>
          </aside>
        </section>

        <section className="lower-grid">
          <article className="card goals-card">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">The week at a glance</p>
                <h2>Active goals</h2>
                <p>{derived.totalWorkload}% of your workload is currently allocated.</p>
              </div>
              <button className="button button-small" type="button" onClick={openNewGoal}>Add another</button>
            </div>
            <div className="goal-list">
              {derived.weekProgress.map(({ goal, value, target, ratio }) => (
                <div className="goal-row" key={goal.id} style={{ "--goal-color": goal.color } as CSSProperties}>
                  <button className="goal-name" type="button" onClick={() => openEditGoal(goal)} aria-label={`Edit ${goal.name}`}>
                    <span className="goal-dot" />
                    <span><strong>{goal.name}</strong><small>{goal.target} {goal.unit} / {goal.cadence} · {goal.workload}% workload</small></span>
                  </button>
                  <div className="goal-progress">
                    <div className="goal-progress-copy"><span>{Math.round(Math.min(ratio, 1) * 100)}% of target</span><span>{formatNumber(Math.max(target - value, 0))} {goal.unit} left</span></div>
                    <div className="progress-track"><i style={{ width: `${Math.min(ratio * 100, 100)}%` }} /></div>
                  </div>
                  <strong className="goal-value">{formatNumber(value)}<span> / {formatNumber(target)} {goal.unit}</span></strong>
                  <button className="goal-log" type="button" onClick={() => openLog(goal)}>＋ <span>Log</span></button>
                </div>
              ))}
              {!data.goals.length && (
                <div className="empty-state">
                  <h3>Your first goal starts here.</h3>
                  <p>Choose a measurable rhythm, then make it visible.</p>
                  <button className="button button-primary" type="button" onClick={openNewGoal}>Add a goal</button>
                </div>
              )}
            </div>
          </article>

          <article className="card badges-card">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Earned by showing up</p>
                <h2>Milestones</h2>
                <p>{unlockedCount} of {derived.badges.length} badges unlocked.</p>
              </div>
            </div>
            <div className="badge-grid">
              {derived.badges.map((badge) => (
                <div className={`badge${badge.unlocked ? " is-unlocked" : " is-locked"}`} key={badge.id}>
                  <span className="badge-mark" aria-hidden="true">{badge.unlocked ? badge.mark : "·"}</span>
                  <div><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.unlocked ? "Unlocked" : badge.progress}</small></div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <footer className="footer">
          <div><span className="brand-mark small" aria-hidden="true"><span /></span><strong>Steady</strong> · Built for consistency, not perfection.</div>
          <div className="footer-actions">
            <button type="button" onClick={() => importRef.current?.click()}>Import backup</button>
            <button type="button" onClick={exportData}>Export JSON</button>
          </div>
        </footer>
      </div>

      {goalDialogOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setGoalDialogOpen(false);
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title">
            <button className="modal-close" type="button" aria-label="Close goal dialog" onClick={() => setGoalDialogOpen(false)}>×</button>
            <p className="section-kicker">Shape a measurable rhythm</p>
            <h2 id="goal-dialog-title">{editingGoalId ? "Edit goal" : "Add a goal"}</h2>
            <form onSubmit={saveGoal}>
              <label className="field field-full"><span>Goal name</span><input autoFocus required value={goalDraft.name} onChange={(event) => setGoalDraft({ ...goalDraft, name: event.target.value })} placeholder="e.g. Practice piano" /></label>
              <div className="form-grid">
                <label className="field"><span>Target</span><input required type="number" min="0.1" step="0.1" value={goalDraft.target} onChange={(event) => setGoalDraft({ ...goalDraft, target: event.target.value })} /></label>
                <label className="field"><span>Unit</span><input required list="unit-options" value={goalDraft.unit} onChange={(event) => setGoalDraft({ ...goalDraft, unit: event.target.value })} /><datalist id="unit-options"><option value="sessions" /><option value="hours" /><option value="minutes" /><option value="pages" /><option value="reps" /><option value="percent" /></datalist></label>
                <label className="field"><span>Cadence</span><select value={goalDraft.cadence} onChange={(event) => setGoalDraft({ ...goalDraft, cadence: event.target.value as Cadence })}><option value="week">Per week</option><option value="day">Per day</option></select></label>
                <label className="field"><span>Workload share</span><div className="input-suffix"><input required type="number" min="0" max="100" step="1" value={goalDraft.workload} onChange={(event) => setGoalDraft({ ...goalDraft, workload: event.target.value })} /><span>%</span></div></label>
              </div>
              <fieldset className="color-field"><legend>Goal color</legend><div>{GOAL_COLORS.map((color) => <button key={color} type="button" aria-label={`Use color ${color}`} aria-pressed={goalDraft.color === color} style={{ backgroundColor: color }} onClick={() => setGoalDraft({ ...goalDraft, color })} />)}<input type="color" value={goalDraft.color} onChange={(event) => setGoalDraft({ ...goalDraft, color: event.target.value })} aria-label="Choose a custom goal color" /></div></fieldset>
              <p className="form-help">Workload share controls how much this goal influences your weekly score. Shares do not have to total 100%.</p>
              <div className="modal-actions">
                {editingGoalId && <button className="button button-danger" type="button" onClick={deleteGoal}>Delete goal</button>}
                <span />
                <button className="button button-quiet" type="button" onClick={() => setGoalDialogOpen(false)}>Cancel</button>
                <button className="button button-primary" type="submit">{editingGoalId ? "Save changes" : "Add goal"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {logDialogOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setLogDialogOpen(false);
        }}>
          <section className="modal modal-small" role="dialog" aria-modal="true" aria-labelledby="log-dialog-title">
            <button className="modal-close" type="button" aria-label="Close check-in dialog" onClick={() => setLogDialogOpen(false)}>×</button>
            <p className="section-kicker">Make the day visible</p>
            <h2 id="log-dialog-title">Log a check-in</h2>
            <form onSubmit={saveLog}>
              <label className="field field-full"><span>Goal</span><select autoFocus value={loggingGoalId} onChange={(event) => {
                const goal = data.goals.find((item) => item.id === event.target.value);
                setLoggingGoalId(event.target.value);
                if (goal) setLogValue(String(quickAmount(goal)));
              }}>{data.goals.map((goal) => <option value={goal.id} key={goal.id}>{goal.name}</option>)}</select></label>
              <div className="form-grid">
                <label className="field"><span>Amount</span><input required type="number" min="0.1" step="0.1" value={logValue} onChange={(event) => setLogValue(event.target.value)} /></label>
                <label className="field"><span>Date</span><input required type="date" max={todayKey} value={logDate} onChange={(event) => setLogDate(event.target.value)} /></label>
              </div>
              <label className="field field-full"><span>Note <small>optional</small></span><textarea rows={3} value={logNote} onChange={(event) => setLogNote(event.target.value)} placeholder="A quick detail worth remembering" /></label>
              <div className="modal-actions"><span /><span /><button className="button button-quiet" type="button" onClick={() => setLogDialogOpen(false)}>Cancel</button><button className="button button-primary" type="submit">Save check-in</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
