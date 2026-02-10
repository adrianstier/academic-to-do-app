# Bug Bash Report: Dashboards + Views + Analytics

**Scope:** Dashboards + Views + Analytics
**Date:** 2026-02-09
**Auditor:** Claude (Scope Agent)
**Files audited:** 24 / 24

---

## Critical

### BUG-DV-001: Inconsistent overdue count between QuickActions and main stats (DashboardModal)

- **File:** `src/components/DashboardModal.tsx`
- **Lines:** 499-505 vs 169-174
- **Category:** Wrong Data
- **Description:** The `overdueCount` passed to `QuickActions` uses a different date normalization than the main stats computation. The main stats (line 172) sets `dueDate.setHours(23, 59, 59, 999)` then checks `dueDate < today` (where `today` is local midnight). But the QuickActions inline calculation (line 502) sets `dueDate.setHours(0, 0, 0, 0)` and compares `dueDate < today` (also midnight). This means:
  - **Main stats:** A task due today is overdue only if end-of-day today is before midnight today -- never true, so tasks due today are correctly NOT overdue.
  - **QuickActions:** A task due today has `dueDate` set to midnight today and `today` set to midnight today, so `dueDate < today` is false -- also not overdue.
  - **However:** A task due yesterday behaves differently. Main stats: dueDate = yesterday 23:59:59.999, today = today 00:00:00 -- overdue (correct). QuickActions: dueDate = yesterday 00:00:00, today = today 00:00:00 -- overdue (also correct, same result). BUT this is still a maintenance hazard because the two independent calculations are semantically inconsistent and will diverge if either is changed. The QuickActions calculation should reference the already-computed `stats.overdue` instead of duplicating logic.
- **Impact:** The badge count on "My Overdue" QuickAction button could drift from the main overdue stat shown in the dashboard header. Currently produces the same number by coincidence, but any edit to either calculation will break the other.
- **Fix:** Pass `stats.overdue` (already computed) as the `overdueCount` prop instead of recalculating inline.

### BUG-DV-002: dueToday filter fails for users in UTC+ timezones (Dashboard.tsx and DashboardModal.tsx)

- **File:** `src/components/Dashboard.tsx` lines 79-82; `src/components/DashboardModal.tsx` lines 176-180
- **Category:** Timezone Bug
- **Description:** The `dueToday` filter does `new Date(t.due_date)` without normalizing hours, then compares against `today` (local midnight) and `todayEnd` (local 23:59:59.999). When `due_date` is an ISO date string like `"2026-02-09"`, `new Date("2026-02-09")` creates **UTC midnight** (Feb 9 00:00 UTC). For a user in UTC+N (e.g., UTC+5:30 India), this parsed date equals Feb 9 05:30 AM local, which is within the local day. But for a user in UTC-N (e.g., EST = UTC-5), this parsed date equals Feb 8 19:00 local, which is BEFORE `today` (Feb 9 00:00 local), so the task is **excluded from "due today"** and falls into no category.
- **Impact:** Users west of UTC will see tasks due today missing from the "Due Today" section. Tasks literally vanish from the dashboard. This affects all of the Americas (UTC-3 through UTC-10).
- **Fix:** Normalize `dueDate` with `dueDate.setHours(0, 0, 0, 0)` before comparison, same as the `overdue` filter already does (line 75 in Dashboard.tsx, line 172 in DashboardModal.tsx). The overdue filter correctly normalizes; the dueToday filter does not.

---

## High

### BUG-DV-003: ProgressSummary uses UTC date comparison for "completed today" count

- **File:** `src/components/ProgressSummary.tsx`
- **Lines:** 57-67
- **Category:** Timezone Bug
- **Description:** Both `todayStr` and `updatedDate` are derived via `toISOString().split('T')[0]`, which extracts the **UTC** date. For a user in UTC-5 who completes a task at 11 PM local time (4 AM UTC next day), the UTC date is tomorrow, so the task is NOT counted as "completed today" even though it was completed today in the user's timezone.
- **Impact:** The "Completed Today" stat in the progress summary modal under-counts for users in negative UTC offsets (Americas) during evening hours, and over-counts for positive UTC offsets during early morning hours.
- **Fix:** Use local date comparison instead:
  ```js
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const todayEndLocal = new Date(todayLocal);
  todayEndLocal.setHours(23, 59, 59, 999);
  // then compare: updatedAt >= todayLocal && updatedAt <= todayEndLocal
  ```

### BUG-DV-004: StrategicDashboard overdue detection fires on goals due today

- **File:** `src/components/StrategicDashboard.tsx`
- **Lines:** 171-174, 832-833
- **Category:** Timezone Bug / Wrong Data
- **Description:** Overdue check is `new Date(g.target_date) < new Date()`. If `target_date` is `"2026-02-09"`, this creates UTC midnight. After midnight local time in UTC+ zones (or after midnight UTC in any zone), `new Date()` will be greater, marking a goal due today as overdue. Additionally, no hour normalization is applied, so the overdue status flickers throughout the day as `new Date()` crosses UTC midnight.
- **Impact:** Goals due today show red "overdue" styling in both the stats bar (line 174) and the table view (line 832). Users see goals turn red at the wrong time.
- **Fix:** Normalize both dates to local midnight:
  ```js
  const targetDate = new Date(g.target_date);
  targetDate.setHours(23, 59, 59, 999);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return targetDate < now;
  ```

### BUG-DV-005: WeeklyProgressChart `isToday` highlights wrong day on weekends

- **File:** `src/components/WeeklyProgressChart.tsx`
- **Line:** 241
- **Category:** Wrong Data
- **Description:** `isToday` is computed as `index === weekData.length - 1`, which always highlights the last bar. The data collection (lines 46-80) walks backwards from today, skipping weekends, and collects 5 weekdays. If today is Saturday, the cursor skips Saturday, collects Friday through Monday, reverses to [Mon, Tue, Wed, Thu, Fri]. The last element is Friday, but today is Saturday -- Friday gets incorrectly highlighted as "today" with a special blue color and "Today" label.
- **Impact:** On Saturdays and Sundays, the chart visually lies about which day is today. The highlighted bar is always Friday, even on weekends.
- **Fix:** Compare the actual date of each `day.date` against today:
  ```js
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const isToday = day.date.getTime() === todayDate.getTime();
  ```

### BUG-DV-006: DailyDigestPanel missing `onNavigateToTask` in both parents

- **File:** `src/components/views/DashboardPage.tsx` lines 180-185; `src/components/Dashboard.tsx` lines 214-219
- **Category:** Props Not Passed / Dead Button
- **Description:** `DailyDigestPanel` accepts an optional `onNavigateToTask` prop (line 29 of DailyDigestPanel.tsx) and renders clickable task rows that call `onTaskClick?.(task.id)` (line 85). Both `DashboardPage.tsx` and `Dashboard.tsx` mount `DailyDigestPanel` without passing `onNavigateToTask`. The individual task rows in the overdue and today's-tasks sections are rendered as `<button>` elements, but clicking them invokes `onTaskClick?.()` which is `undefined`, so nothing happens. Users see a button with hover state and cursor, click it, and nothing occurs.
- **Impact:** Clicking any individual task in the Daily Digest panel does nothing. The overdue/today filter buttons still work, but the per-task navigation is completely broken.
- **Fix:** Pass `onNavigateToTask` from the parent. Both `DashboardPage.tsx` and `Dashboard.tsx` receive navigation-related props that could be wired through.

---

## Medium

### BUG-DV-007: `Math.random()` in `generateTaskSuggestion` causes unstable AI suggestions

- **File:** `src/lib/aiDashboardInsights.ts`
- **Line:** 170
- **Category:** Performance / Wrong Data
- **Description:** `generateTaskSuggestion` returns `pool[Math.floor(Math.random() * pool.length)]` which produces a different suggestion string on every call. Since this function is called inside `useMemo` dependencies or during render, the suggestion text can change every time the component re-renders (e.g., when another todo is toggled). This breaks React memoization because the output is non-deterministic.
- **Impact:** AI focus suggestions in the dashboard flicker or change text unexpectedly when unrelated state changes cause re-renders. The "Today's Focus" suggestion in `DashboardModal.tsx` (line 510) can show different text each time the modal re-opens or the todo list updates.
- **Fix:** Use a deterministic selection based on the task ID or current date:
  ```js
  const hash = task.id.charCodeAt(0) + new Date().getDate();
  return pool[hash % pool.length];
  ```

### BUG-DV-008: InsightCard uses fragile string parsing for dark mode class extraction

- **File:** `src/components/dashboard/InsightCard.tsx`
- **Lines:** 89-91
- **Category:** Dark Mode
- **Description:** The component manually parses Tailwind class strings to extract dark-mode variants:
  ```js
  darkMode ? styles.iconBg.replace('dark:', '') : styles.iconBg.split(' ')[0]
  // and
  darkMode ? styles.iconColor.split(' ')[1]?.replace('dark:', '') : styles.iconColor.split(' ')[0]
  ```
  This assumes a specific format: `"light-class dark:dark-class"` with exactly one space separator and `dark:` prefix. For example, `iconBg: 'bg-blue-500/10 dark:bg-blue-400/20'` -- the light extraction takes index `[0]` ("bg-blue-500/10") and the dark extraction does `replace('dark:', '')` on the full string, producing `"bg-blue-500/10 bg-blue-400/20"` (BOTH classes applied). This means in dark mode, both the light and dark background classes are applied simultaneously.
- **Impact:** In dark mode, InsightCard icon backgrounds have conflicting CSS classes. The visual result depends on CSS specificity and may appear as the wrong color or as a blend of light/dark styles.
- **Fix:** Store light and dark styles as separate properties in the `typeStyles` object, or use Tailwind's native `dark:` variant and let the framework handle mode switching.

### BUG-DV-009: StrategicDashboard `useEscapeKey` always active, conflicts with sub-modals

- **File:** `src/components/StrategicDashboard.tsx`
- **Line:** 126
- **Category:** Conditional Rendering / UX
- **Description:** `useEscapeKey(onClose)` is called without an `enabled` option. The `useEscapeKey` hook (used elsewhere with `{ enabled: show }`) will always listen for Escape. When a user opens a sub-modal (e.g., the goal creation/edit modal or delete confirmation), pressing Escape closes the entire StrategicDashboard instead of just the sub-modal.
- **Impact:** Users cannot dismiss sub-modals with Escape without also closing the parent dashboard. This is a jarring UX issue where one Escape press closes two layers of UI simultaneously.
- **Fix:** Add `{ enabled: !showGoalModal && !showDeleteConfirm }` (or whatever the relevant sub-modal state variables are) to disable the parent escape handler when sub-modals are open.

### BUG-DV-010: Unused `_IconComponent` variable in DashboardModal AI insights section

- **File:** `src/components/DashboardModal.tsx`
- **Line:** 801
- **Category:** Dead Code / Performance
- **Description:** `const _IconComponent = getInsightIcon(insight.type)` is computed for every insight but never rendered. The component uses `insight.icon` (an emoji string, line 812) instead. The `getInsightIcon` function (presumably) maps insight types to Lucide icon components, but the result is discarded. The underscore prefix indicates someone noticed this but left it in.
- **Impact:** Minor: unnecessary function call on each insight render. No visible bug, but dead code that adds confusion and a tiny performance cost.
- **Fix:** Remove the line or use the icon component instead of the emoji.

---

## Low

### BUG-DV-011: QuickActions fallback `(() => {})` creates silent dead buttons

- **File:** `src/components/dashboard/QuickActions.tsx`
- **Lines:** 37, 44, 52, 58
- **Category:** Dead Button
- **Description:** Each action uses `onHandler || (() => {})` as its click handler. If a parent does not provide `onAddTask`, `onFilterOverdue`, `onStartFocus`, or `onOpenChat`, the button renders with a no-op handler. The button appears interactive (hover states, cursor pointer) but does nothing when clicked.
- **Impact:** Low currently because both known parents (`DashboardModal.tsx` and the Doer/Manager dashboards) do pass these props. However, if QuickActions is reused in a new context without all props, users will encounter invisible dead buttons with no feedback.
- **Fix:** Either (a) make the required props non-optional in the interface, (b) disable/hide buttons when handlers are not provided, or (c) show a tooltip indicating the feature is unavailable.

### BUG-DV-012: StatCard animations do not respect `prefers-reduced-motion`

- **File:** `src/components/dashboard/StatCard.tsx`
- **Lines:** 67-72
- **Category:** Accessibility (related to Performance)
- **Description:** The `motion.div` wrapper uses `whileHover` and `initial/animate` transitions without checking `useReducedMotion`. Users who have enabled "reduce motion" in their OS accessibility settings will still see slide-up animations and hover lift effects. While framer-motion does have some built-in reduced-motion support, the explicit `transition` configuration overrides defaults.
- **Impact:** Accessibility issue for users with vestibular disorders or motion sensitivity. Not a data bug but an accessibility compliance gap.
- **Fix:** Use framer-motion's `useReducedMotion()` hook and conditionally disable or simplify animations.

### BUG-DV-013: StrategicDashboard hardcoded dark mode classes in table view

- **File:** `src/components/StrategicDashboard.tsx`
- **Lines:** 832-834
- **Category:** Dark Mode
- **Description:** The overdue date badge in table view uses hardcoded `bg-red-500/10 text-red-500` for overdue and `bg-slate-700 text-slate-300` / `bg-slate-100 text-slate-600` for normal dates, switching based on `darkMode` boolean. These are raw Tailwind colors rather than the CSS custom property system (`var(--danger)`, `var(--surface-2)`, etc.) used in the rest of the codebase. This means the colors don't respond to theme changes or the design token system.
- **Impact:** Visual inconsistency with the rest of the app's theming. If the app switches to a different theme or color scheme via CSS custom properties, these badges won't update.
- **Fix:** Replace with CSS custom property equivalents: `bg-[var(--danger-light)] text-[var(--danger)]` for overdue, `bg-[var(--surface-2)] text-[var(--text-muted)]` for normal.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 4     |
| Medium   | 4     |
| Low      | 3     |
| **Total** | **13** |

### Top priorities for immediate fix:
1. **BUG-DV-002** (Critical): dueToday timezone bug -- tasks due today vanish for users west of UTC
2. **BUG-DV-001** (Critical): Duplicated overdue calculation with inconsistent normalization
3. **BUG-DV-004** (High): Goals due today marked as overdue in StrategicDashboard
4. **BUG-DV-006** (High): DailyDigestPanel task click handler never wired up
5. **BUG-DV-003** (High): ProgressSummary UTC date comparison miscounts evening completions

### Files with zero bugs found:
- `src/components/dashboard/AnimatedProgressRing.tsx` -- clean implementation
- `src/components/dashboard/DailyDigestPanel.tsx` -- well structured, bug is in parents not passing props
- `src/components/dashboard/DailyDigestSkeleton.tsx` -- simple skeleton, no logic
- `src/components/dashboard/DoerDashboard.tsx` -- date handling is correct
- `src/components/dashboard/ManagerDashboard.tsx` -- date handling matches DoerDashboard
- `src/components/dashboard/index.ts` -- barrel export only
- `src/components/views/AIInbox.tsx` -- self-contained, no date or dashboard bugs
- `src/components/views/ChatView.tsx` -- simple wrapper
- `src/components/views/index.ts` -- barrel export only
- `src/components/ArchivedTaskModal.tsx` -- read-only display, no calculations
- `src/components/ArchiveView.tsx` -- filtering is straightforward
- `src/lib/dashboardUtils.ts` -- localStorage helpers, no date logic
- `src/lib/managerDashboardInsights.ts` -- clean analytics logic
- `src/lib/summaryGenerator.ts` -- format-only, no date bugs
