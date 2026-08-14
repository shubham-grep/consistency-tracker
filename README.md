# Steady

Steady is a private, browser-only consistency tracker. It turns goal check-ins into a contribution calendar, weekly KPI progress, streaks, and milestone badges.

## What it includes

- Goals with daily or weekly targets, custom units, workload weighting, and colors
- A 12-month contribution calendar with per-day check-in details
- Weighted weekly completion, current and longest streaks, and active-day totals
- Automatically unlocked duration and milestone badges
- Check-in history, notes, editing, and deletion
- LocalStorage persistence with JSON backup and restore
- No server, database, account, analytics, or network requests

The first visit includes sample activity so the full interface is visible immediately. From then on, every change is stored only in that browser.

## Run locally

```bash
npm install
npm run dev
```

## Build

The regular build produces the Sites-compatible output:

```bash
npm run build
```

The static build produces an `out` directory suitable for GitHub Pages, Vercel, or any static host:

```bash
npm run build:static
```

## Deploy

- **GitHub Pages:** push to `main`, enable Pages with **GitHub Actions** as the source, and the included workflow publishes the static export.
- **Vercel:** import the repository. The included `vercel.json` selects the static build and `out` directory automatically.

## Backups

Use **Export JSON** before moving browsers or clearing site data. **Import** replaces the data on the current device only after confirmation.
