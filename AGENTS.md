# Steady project context

## Product

Steady is a browser-only consistency tracker. Users create measurable goals, log progress, review a contribution calendar, monitor streaks and weekly completion, earn milestone badges, and move their data between browsers with JSON export/import.

The product must remain private and local-first:

- No application server, API, account system, analytics, or database.
- All calculations happen in the browser.
- Progress is stored in `localStorage` and backed up/restored through JSON files.
- The site must remain statically deployable to GitHub Pages and Vercel.

The current private deployment is:
`https://steady-consistency-tracker.shubham1199.chatgpt.site`

## Current implementation

- React 19, Next.js 16, and TypeScript.
- Custom responsive CSS in `app/globals.css`.
- Main product logic and interface in `app/page.tsx`.
- Static export is enabled in `next.config.ts`.
- `npm run build` creates the Sites-compatible Vinext/Vite build.
- `npm run build:static` creates the static `out` directory.
- GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`.
- Vercel static deployment is configured in `vercel.json`.
- Tests live in `tests/rendered-html.test.mjs`.

The current interface uses the warm editorial theme: parchment background, navy ink, serif headings, saffron/coral/sage accents, and lightly tactile cards. This theme is intentionally scheduled to be replaced in the next iteration.

## Current data model and behavior

The `TrackerData` schema is version 1 and is stored under the localStorage key `steady-consistency-tracker-v1`.

Each goal currently contains:

- `id`
- `name`
- numeric `target`
- custom `unit`
- `cadence`: `day` or `week`
- numeric `workload`
- `color`
- `createdAt`

Each progress log contains a `goalId`, local date, positive numeric value, optional note, and creation timestamp. Because every contribution already references a goal, per-goal calendars can be derived without changing the log model.

The current combined weekly score calculates each goal's weekly completion, caps it at 100%, multiplies it by its workload value, and normalizes by the sum of all workload values. Daily targets are multiplied by seven. Workload totals can currently exceed 100 because they act as relative weights.

Badges currently cover first check-in, 7-day streak, 100 check-ins, 30-day streak, full weighted week, and 365 active days.

The first visit creates realistic sample goals and history so the finished interface is immediately visible.

## Next iteration goals

Implement these three goals together unless the user changes the scope:

1. Replace the warm editorial theme with a more programmer-oriented UI. Use an IDE/terminal-inspired visual language, compact data presentation, crisp monospace details, strong hierarchy, and accessible contrast. Keep the interface polished and responsive; do not turn it into a novelty terminal or reduce usability.
2. Replace `workload` with a priority level from `P1` through `P5`, where `P1` is the highest priority and `P5` is the lowest. Remove percentage-allocation language from the interface. If the overall weekly score remains priority-weighted, use a clear documented mapping such as P1=5, P2=4, P3=3, P4=2, and P5=1, normalized across active goals.
3. Keep the existing combined contribution calendar and add a separate contribution calendar for every goal. Goal calendars should reuse the same date range, intensity semantics, tooltip/accessibility behavior, and underlying logs while filtering by `goalId`.

## Migration requirements

Do not discard existing browser data when implementing priorities.

- Introduce a versioned migration from schema version 1 to the new schema.
- Convert legacy workload values to sensible P1–P5 priorities, or preserve them until the user can confirm the mapping.
- Continue accepting version 1 JSON backups during import.
- Export only the newest schema after migration.
- Keep existing goal IDs and logs intact so overall and per-goal calendars remain consistent.

## Verification expectations

After changes:

- Run `npm run build`.
- Run `npm run build:static`.
- Run `node --test tests/rendered-html.test.mjs`.
- Verify that there are no network calls or server-backed persistence paths.
- Verify responsive calendar overflow, keyboard focus, modal interactions, localStorage migration, and JSON round trips in proportion to the changed behavior.
