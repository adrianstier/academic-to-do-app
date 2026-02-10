# Bug Bash Report: Shared Libraries, Hooks, UI Primitives & Types

**Scope Agent:** Claude
**Date:** 2026-02-09
**Files Audited:** 60+
**Scope:** `src/lib/`, `src/hooks/`, `src/components/ui/`, `src/types/`, standalone `src/components/` files

---

## Critical

### 1. Race Condition: RLS context set asynchronously but client returned immediately
**File:** `src/lib/supabaseClient.ts` lines 38-65
**Bug:** `createSupabaseClient()` calls `client.rpc('set_config', ...)` via `.then()` (fire-and-forget) to set the RLS user context, but returns the client synchronously on line 65. Any query made before those two `.then()` callbacks resolve will execute without RLS context, potentially exposing data across tenant boundaries.
**Impact:** Callers can issue queries before `app.user_id` and `app.enable_rls` are set. In a multi-tenant environment, this is a data isolation failure.
**Fix:** `await` both `rpc` calls before returning the client, or change the function signature to `async` and have callers `await` it.

---

## High

### 2. requestAnimationFrame cleanup only cancels first frame
**File:** `src/components/ui/Toast.tsx` lines 129-143
**Bug:** The auto-dismiss progress animation calls `requestAnimationFrame(updateProgress)` recursively inside `updateProgress` (line 138), spawning a new frame ID each iteration. The cleanup function on line 143 only stores and cancels the *initial* `animationId` from line 142. When the effect is cleaned up (e.g., component unmount, `duration`/`toast.id`/`onDismiss` change), all subsequently spawned frames continue running.
**Impact:** Memory leak and stale closure bugs -- the animation continues after unmount, calling `onDismiss` on a stale toast ID or calling `setProgress` on an unmounted component.
**Fix:** Store the latest frame ID in a `ref` and cancel it in the cleanup:
```ts
const frameRef = useRef<number>();
// Inside updateProgress: frameRef.current = requestAnimationFrame(updateProgress);
// Cleanup: return () => cancelAnimationFrame(frameRef.current!);
```

### 3. Static tooltip ID causes duplicate IDs in the DOM
**File:** `src/components/ui/Tooltip.tsx` line 399
**Bug:** Every tooltip instance renders with `id="tooltip"`. When multiple tooltips are open simultaneously (or multiple `aria-describedby="tooltip"` references exist), the DOM has duplicate IDs. This violates the HTML spec and breaks screen reader association -- `aria-describedby="tooltip"` will only find the first element with that ID.
**Impact:** Accessibility failure (WCAG 4.1.1 Parsing / 1.3.1 Info and Relationships). Screen readers may announce the wrong tooltip content.
**Fix:** Generate a unique ID per tooltip instance (e.g., `useId()` from React 18, or `useRef(Math.random().toString(36).slice(2))`).

### 4. Cmd+V shortcut for voice input conflicts with system paste
**File:** `src/components/ui/AIFeaturesMenu.tsx` lines 105-108
**Bug:** The keyboard shortcut handler binds `Cmd/Ctrl+V` to trigger voice input. This overrides the OS-level paste shortcut. When a user is in a text input field and presses Cmd+V, `e.preventDefault()` is called (line 106), blocking paste and triggering voice input instead.
**Impact:** Users cannot paste text via keyboard when this component is mounted. This is a severe usability regression.
**Fix:** Use a different shortcut that does not conflict with system shortcuts (e.g., `Cmd+Shift+V` or `Cmd+.`).

### 5. In-place array mutation during render
**File:** `src/components/ui/Avatar.tsx` line 319
**Bug:** `visibleChildren.reverse()` mutates the `visibleChildren` array in place. Since `visibleChildren` is derived from `childArray.slice(0, max)` (which creates a new array), this does not corrupt props. However, `.reverse()` is called inside the JSX render path, meaning it runs on every render. Combined with React's potential to call render multiple times (StrictMode, concurrent mode), this causes the array to flip back and forth, producing inconsistent rendering.
**Impact:** In React StrictMode (default in development), the array order flips on double-render, causing avatar stacking order to be wrong every other render.
**Fix:** Use `[...visibleChildren].reverse()` or `visibleChildren.toReversed()` to avoid in-place mutation.

---

## Medium

### 6. Hardcoded colors bypass CSS variable theming system
**Files & Lines:**
- `src/components/ui/SaveIndicator.tsx` lines 25-26, 32-33, 39: `text-slate-400`, `bg-slate-700/50`, `text-emerald-400`, `bg-emerald-500/10`, `text-red-400`, `bg-red-500/10`
- `src/components/CompletionCelebration.tsx`: `bg-white dark:bg-gray-800`
- `src/components/CelebrationEffect.tsx`: `bg-white dark:bg-neutral-900`
- `src/components/ConfirmDialog.tsx`: `bg-red-100`, `bg-amber-100`
- `src/components/KeyboardShortcutsModal.tsx` lines 111-113, 116-165: `bg-slate-800`, `bg-slate-700`, `text-white`, `text-slate-300`, `bg-slate-600`, etc. (entire component uses Tailwind colors instead of CSS vars)
- `src/components/PullToRefresh.tsx` lines 109, 125-128, 134: `bg-slate-700`, `text-slate-400`, `text-slate-300`, `text-[#2c5282]`
- `src/components/WelcomeBackNotification.tsx` lines 145-247: `bg-white dark:bg-slate-800`, `text-slate-800 dark:text-slate-100`, `bg-slate-50 dark:bg-slate-700/50`, etc.
- `src/components/LoadingSkeletons.tsx` (throughout): All skeleton components use `bg-slate-800`, `bg-slate-700`, `bg-slate-200` etc.
- `src/components/CategoryConfidenceIndicator.tsx` lines 39-56, 105, 186: `text-emerald-600 dark:text-emerald-400`, `bg-emerald-50`, `text-gray-900 dark:text-gray-100`, `bg-blue-600`, etc.

**Bug:** The app uses a CSS variable theming system (`--surface`, `--foreground`, `--text-muted`, `--accent`, etc.), but these components use hardcoded Tailwind colors or `dark:` modifiers. If the theme is toggled via `ThemeContext` or if custom themes are added, these components will not update.
**Impact:** Visual inconsistency when theme changes. Components appear "stuck" in one color scheme while the rest of the app updates.
**Fix:** Replace hardcoded colors with CSS variable equivalents (e.g., `text-slate-400` -> `text-[var(--text-muted)]`, `bg-slate-700/50` -> `bg-[var(--surface-2)]`).

### 7. `useFeatureFlag` is not a reactive hook
**File:** `src/lib/featureFlags.ts` lines 125-127
**Bug:** `useFeatureFlag` is named as a React hook but contains no React primitives (`useState`, `useEffect`, `useRef`, etc.). It simply delegates to `isFeatureEnabled()`, which reads from `process.env` and `localStorage`. Because there is no state subscription, the component will not re-render when feature flags change at runtime (e.g., via localStorage or environment variable update).
**Impact:** Feature flag changes at runtime will not be reflected in the UI until a full page reload. Callers may assume the hook is reactive based on the `use` prefix convention.
**Fix:** Either rename to `getFeatureFlag` (indicating it's not reactive) or implement proper reactivity with `useState` + `useEffect` + `storage` event listener.

### 8. CountUp animation restarts when `onComplete` reference changes
**File:** `src/components/ui/CountUp.tsx` line 63
**Bug:** `onComplete` is in the `useEffect` dependency array. If a parent passes an inline callback (e.g., `onComplete={() => doSomething()}`), a new function reference is created on every render, causing the entire counting animation to restart from `start` every render cycle.
**Impact:** The count-up animation never completes when used with inline callbacks -- it restarts in an infinite loop.
**Fix:** Move `onComplete` to a ref:
```ts
const onCompleteRef = useRef(onComplete);
onCompleteRef.current = onComplete;
// In effect: onCompleteRef.current?.();
// Remove onComplete from deps array
```

### 9. `NotificationPermissionBanner` setTimeout not cleaned up
**File:** `src/components/NotificationPermissionBanner.tsx` line 57
**Bug:** `setTimeout(() => setVisible(true), 2000)` is called inside an async function within `useEffect`, but the timeout ID is not captured and not cleaned up in the effect's return function. If the component unmounts within 2 seconds, `setVisible(true)` is called on an unmounted component.
**Impact:** React warning "Can't perform a React state update on an unmounted component" (in React 17) or silent no-op (React 18+). Minor memory concern.
**Fix:** Capture the timeout ID and clear it in the cleanup function.

### 10. `WelcomeBackNotification` progress bar timer drift
**File:** `src/components/WelcomeBackNotification.tsx` lines 118-128
**Bug:** In `handleMouseLeave`, a new `setInterval` is created with the same fixed `step` as the original, but the `remaining` time is calculated from the current `progress` state. Due to React's asynchronous state updates, `progress` may be stale when `handleMouseLeave` is called. Additionally, the new interval runs for `remaining` ms (via setTimeout) but uses the original `step` size, so the progress bar may not reach exactly 0% when the setTimeout fires `onClose`.
**Impact:** Progress bar visual desync -- it may jump or not accurately reflect remaining time after hover pause/resume.
**Fix:** Use a ref to track the actual remaining time, and recalculate step based on actual remaining duration.

### 11. `WelcomeBackNotification` uses hardcoded colors throughout
**File:** `src/components/WelcomeBackNotification.tsx` lines 145-247
**Bug:** Uses `bg-white dark:bg-slate-800`, `text-slate-800 dark:text-slate-100`, `border-slate-200 dark:border-slate-700`, `text-slate-500 dark:text-slate-400`, etc. throughout instead of CSS variables.
**Impact:** Same as bug #6 -- theme inconsistency. This component also hardcodes the gradient colors `from-[#2c5282] to-[#72B5E8]` (line 149).
**Note:** Merged with #6 for tracking but called out separately due to the extensive use.

### 12. `KeyboardShortcutsModal` duplicate escape handling
**File:** `src/components/KeyboardShortcutsModal.tsx` lines 83, 86-90
**Bug:** Both `useEscapeKey(onClose)` (line 83) and `useFocusTrap({ onEscape: onClose })` (line 87) register separate Escape key handlers. When the user presses Escape, `onClose` is called twice.
**Impact:** Double-firing `onClose` may cause unexpected behavior in parent components (e.g., toggling open/closed state back, or firing analytics events twice).
**Fix:** Remove `onEscape` from the `useFocusTrap` options, since `useEscapeKey` already handles it.

---

## Low

### 13. `navigator.platform` is deprecated
**File:** `src/hooks/useKeyboardShortcuts.ts` (platform detection)
**File:** `src/components/KeyboardShortcutsModal.tsx` line 22
**Bug:** Uses `navigator.platform` for Mac detection, which is deprecated and returns a fixed string in some browsers. Chrome plans to freeze it to `"Linux x86_64"` for privacy.
**Impact:** Mac keyboard shortcuts (`Cmd` vs `Ctrl`) may show incorrectly in future browser versions.
**Fix:** Use `navigator.userAgentData?.platform` with fallback to `navigator.platform`, or use feature detection.

### 14. Logger SSN pattern matches any 9-digit number
**File:** `src/lib/logger.ts` line 33 (approximately)
**Bug:** The `\b\d{9}\b` regex pattern used for SSN detection will match any 9-digit number -- including valid database IDs, timestamps, ZIP codes, etc. This causes over-aggressive redaction of legitimate data in logs.
**Impact:** Useful debugging information is unnecessarily redacted. False positives reduce log utility.
**Fix:** Use a more specific SSN pattern like `\b\d{3}-?\d{2}-?\d{4}\b` that expects the optional hyphen format.

### 15. `CategoryConfidenceIndicator` AnimatePresence wraps non-conditional content
**File:** `src/components/CategoryConfidenceIndicator.tsx` lines 88-200
**Bug:** `AnimatePresence` wraps `motion.div` but the component already returns `null` early on line 80 when `patternMatch` is null. The `AnimatePresence` never actually sees its children removed -- it either renders with the child or doesn't render at all. This means the exit animation defined on line 92 (`exit={{ height: 0, opacity: 0 }}`) never plays.
**Impact:** Exit animation is dead code. The component disappears instantly instead of animating out.
**Fix:** Move the null check inside `AnimatePresence` so it can track the child's removal:
```tsx
<AnimatePresence>
  {patternMatch && (
    <motion.div ...>
```

### 16. `PullToRefresh` stale closure in touch handlers
**File:** `src/components/PullToRefresh.tsx` lines 36-53
**Bug:** `handleTouchMove` reads `isPulling` from its closure via `useCallback` dependencies. However, `handleTouchStart` sets `setIsPulling(true)`, which is an async state update. If `touchmove` fires in the same event loop tick as `touchstart`, `isPulling` will still be `false` in the `handleTouchMove` closure.
**Impact:** The very first touchmove event after touchstart may be ignored. In practice, this is barely noticeable because touchmove events fire rapidly, and by the second event the state has updated. Marginal UX impact.
**Fix:** Use a ref alongside the state for synchronous reads:
```ts
const isPullingRef = useRef(false);
// In handleTouchStart: isPullingRef.current = true;
// In handleTouchMove: if (!isPullingRef.current || ...) return;
```

### 17. `LoadingSkeletons` all use `darkMode` prop instead of CSS variables
**File:** `src/components/LoadingSkeletons.tsx` (throughout)
**Bug:** All skeleton components accept a `darkMode` boolean prop and switch between hardcoded Tailwind classes. The most recently added `AIInboxSkeleton` (line 191) uses CSS variables correctly, showing the inconsistency.
**Impact:** If the `darkMode` prop is not passed or is incorrect, skeletons display in the wrong theme. Inconsistent with the rest of the app's CSS variable approach.
**Fix:** Migrate all skeleton components to use CSS variables like `AIInboxSkeleton` does.

### 18. `BottomTabs` uses opacity-based transparency on CSS variable colors
**File:** `src/components/BottomTabs.tsx` line 103
**Bug:** `bg-[var(--surface)]/95` applies Tailwind opacity to a CSS variable. This syntax only works if the CSS variable is defined in a Tailwind-compatible format (e.g., `rgb(r g b)` without the `rgb()` wrapper, or using Tailwind's special format). If `--surface` is defined as a hex color like `#1a1a2e`, the `/95` opacity modifier silently fails and no background is applied.
**Impact:** The bottom tabs may have no background (fully transparent) depending on how the CSS variable is defined, making text unreadable on top of page content.
**Fix:** Use `bg-[var(--surface)] opacity-95` or ensure CSS variables are defined in Tailwind-compatible format.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 4     |
| Medium   | 7     |
| Low      | 6     |
| **Total**| **18** |

### Top Priority Fixes
1. **supabaseClient.ts** -- `await` the RLS `rpc` calls before returning the client (Critical)
2. **Toast.tsx** -- Fix requestAnimationFrame leak with a ref (High)
3. **Tooltip.tsx** -- Generate unique IDs per instance (High)
4. **AIFeaturesMenu.tsx** -- Change Cmd+V shortcut to avoid paste conflict (High)
5. **Avatar.tsx** -- Use non-mutating `.toReversed()` or spread+reverse (High)
6. **SaveIndicator, Celebrations, KeyboardShortcuts, PullToRefresh, WelcomeBack, LoadingSkeletons, CategoryConfidence** -- Migrate from hardcoded colors to CSS variables (Medium, batch fix)
