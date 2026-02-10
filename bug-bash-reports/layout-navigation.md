# Bug Bash Report: Layout + Navigation + Chat + Team Management + Auth

**Scope Agent:** Claude Opus 4.6
**Date:** 2026-02-09
**Files Audited:** 27

---

## Files In Scope

- `src/components/layout/AppShell.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/CommandPalette.tsx`
- `src/components/layout/EnhancedBottomNav.tsx`
- `src/components/layout/NavigationSidebar.tsx`
- `src/components/layout/TaskBottomSheet.tsx`
- `src/components/layout/index.ts`
- `src/components/LoginScreen.tsx`
- `src/components/UserSetup.tsx`
- `src/components/UserSwitcher.tsx`
- `src/components/TeamSwitcher.tsx`
- `src/components/TeamManagement/TeamSettingsModal.tsx`
- `src/components/TeamManagement/TeamInviteSection.tsx`
- `src/components/TeamManagement/TeamMembersList.tsx`
- `src/components/TeamManagement/index.ts`
- `src/components/TeamOnboardingModal.tsx`
- `src/components/FloatingChat.tsx`
- `src/components/FloatingChatButton.tsx`
- `src/components/ChatPanel.tsx`
- `src/components/chat/TaskAssignmentCard.tsx`
- `src/components/chat/index.ts`
- `src/components/ActivityFeed.tsx`
- `src/components/AppMenu.tsx`
- `src/components/AuthProvider.tsx`
- `src/components/MainApp.tsx`
- `src/contexts/TeamContext.tsx`
- `src/contexts/ThemeContext.tsx`

---

## Critical

### BUG-001: LoginScreen queries Supabase stats without authentication

**File:** `src/components/LoginScreen.tsx` lines 172-213
**Category:** Auth flow / Data exposure
**Description:** The LoginScreen component fetches aggregate stats (total tasks, completed this week, active users) from Supabase on the login screen, before any user has authenticated. These queries execute against `todos` and `users` tables. If Row Level Security (RLS) policies are not configured to block anonymous reads on these tables, this leaks team-wide task counts and user activity data to anyone who can view the login page.

```tsx
// Line 180-206 - runs on login screen before any auth
const { count: totalTasks } = await supabase
  .from('todos')
  .select('*', { count: 'exact', head: true });

const { count: completedThisWeek } = await supabase
  .from('todos')
  .select('*', { count: 'exact', head: true })
  .eq('completed', true)
  .gte('updated_at', startOfWeek.toISOString());

const { count: activeUsers } = await supabase
  .from('users')
  .select('*', { count: 'exact', head: true })
  .gte('last_login', sevenDaysAgo.toISOString());
```

**Impact:** If RLS does not block anonymous reads, any unauthenticated visitor sees task counts, completion metrics, and active user counts. Even with RLS blocking the data, this still generates unnecessary Supabase requests on every login page load.
**Suggested fix:** Move stats fetching to after authentication, or verify that RLS policies on `todos` and `users` tables deny reads to the anonymous/unauthenticated role.

---

## High

### BUG-002: EnhancedBottomNav - Tailwind opacity modifier does not work with CSS custom properties

**File:** `src/components/layout/EnhancedBottomNav.tsx` lines 102-103
**Category:** Responsive / Dark mode
**Description:** The dark mode background class `bg-[var(--surface)]/95` uses Tailwind's opacity modifier syntax (`/95`) with an arbitrary value containing a CSS custom property. Tailwind's opacity modifier works by decomposing the color into its RGB channels and applying alpha. CSS custom properties (e.g., `var(--surface)`) are opaque to Tailwind at build time, so the `/95` modifier is silently ignored. The background will render at full opacity instead of 95% transparency, losing the glass-morphism backdrop-blur effect.

```tsx
${darkMode
  ? 'bg-[var(--surface)]/95 backdrop-blur-xl border-t border-white/10'
  : 'bg-white/95 backdrop-blur-xl border-t border-[var(--border)]'
}
```

**Impact:** On mobile in dark mode, the bottom nav renders as a solid opaque background instead of a frosted-glass translucent effect. Content scrolling behind the nav is not visible through it, breaking the intended design.
**Suggested fix:** Use an inline style for the background with explicit alpha, e.g., `style={{ backgroundColor: 'rgba(var(--surface-rgb), 0.95)' }}` (requires defining `--surface-rgb` as raw RGB values), or use `bg-[color-mix(in_srgb,var(--surface)_95%,transparent)]`.

### BUG-003: TaskBottomSheet Copy and Share buttons have no onClick handlers

**File:** `src/components/layout/TaskBottomSheet.tsx` lines 414-443
**Category:** Navigation / Functionality
**Description:** The Copy and Share buttons in the TaskBottomSheet action bar render as `<button>` elements with styling and icons but have no `onClick` handler. Pressing them does nothing.

```tsx
<button
  className={`flex flex-col items-center gap-1 p-2 rounded-xl touch-manipulation
    ${darkMode ? 'active:bg-white/10' : 'active:bg-gray-200'}`}
>
  <Copy className={`w-5 h-5 ${darkMode ? 'text-white/70' : 'text-gray-600'}`} />
  <span className={`text-xs ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>Copy</span>
</button>
```

**Impact:** Users on mobile see interactive-looking buttons that do nothing when tapped, causing confusion. The active state feedback (background color change) makes them appear clickable.
**Suggested fix:** Either implement the copy-to-clipboard and share functionality, or hide/disable these buttons until the handlers are ready.

### BUG-004: AppShell Cmd+B shortcut fires inside text inputs

**File:** `src/components/layout/AppShell.tsx` lines 142-168
**Category:** Keyboard shortcuts
**Description:** The `isInputField` check on line 147-149 is only used to gate the `?` shortcut (line 152). The Cmd+B shortcut (line 165-168) does not check `isInputField`, so pressing Cmd+B while typing in a text input or textarea will toggle the sidebar instead of triggering the browser's native bold formatting (in contentEditable elements) or being ignored. Cmd+K has the same issue but is a less common conflict since browsers don't typically bind it.

```tsx
// isInputField is checked only for '?' shortcut
if (e.key === '?' && !isInputField) { ... }

// Cmd+B does NOT check isInputField
if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
  e.preventDefault();
  setSidebarCollapsed(prev => !prev);
}
```

**Impact:** Users editing rich text or using contentEditable fields cannot use Cmd+B for bold. The sidebar unexpectedly toggles while typing, disrupting workflow.
**Suggested fix:** Add `if (isInputField) return;` guard before the Cmd+B and Cmd+K handlers, or at minimum only skip `e.preventDefault()` when in an input field.

### BUG-005: UserSwitcher PIN modal has no dark mode support

**File:** `src/components/UserSwitcher.tsx` lines 255-309
**Category:** Dark mode
**Description:** The PIN entry modal uses hardcoded light-theme colors throughout:
- Modal container: `bg-white` (line 255)
- Header border: `border-slate-100` (line 258)
- Title text: `text-slate-900` (line 259)
- User name: `text-slate-900` (line 279)
- Subtitle: `text-slate-400` (line 280)
- PIN input: `text-slate-900`, `border-slate-200`, `bg-red-50` (lines 295-301)
- Error background: `bg-red-50` (line 307)

None of these have `dark:` variants or use the CSS variable system (`var(--surface)`, `var(--text)`) used elsewhere in the app.

**Impact:** In dark mode, the PIN modal appears as a bright white card against the dark backdrop, causing visual jarring and poor contrast. The text colors are illegible if the system forces dark mode at the OS level.
**Suggested fix:** Replace hardcoded color classes with CSS variables or add `dark:` Tailwind variants matching the app's dark theme palette.

### BUG-006: TeamMembersList confirmation dialogs missing click-outside dismiss and Escape key handler

**File:** `src/components/TeamManagement/TeamMembersList.tsx` lines 705-821
**Category:** Click-outside / Keyboard
**Description:** The "Suspend Member?" and "Transfer Ownership?" confirmation dialogs render as modal overlays with `fixed inset-0` positioning but:
1. The outer `motion.div` overlay has no `onClick` handler to dismiss on backdrop click.
2. There is no `useEffect` with a keydown listener for the Escape key.

Compare with UserSwitcher (line 251) which correctly has `onClick={closeModal}` on the backdrop overlay.

```tsx
<motion.div
  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
  // No onClick handler on the backdrop
>
```

**Impact:** Users cannot dismiss these confirmation dialogs by clicking outside or pressing Escape. They must click the Cancel button, which is unexpected behavior for modal dialogs and reduces usability.
**Suggested fix:** Add `onClick={() => setConfirmRemoveMember(null)}` to the outer overlay div (with `e.stopPropagation()` on the inner card), and add a keydown listener for Escape.

---

## Medium

### BUG-007: UserSwitcher re-fetches all users on every modalState change

**File:** `src/components/UserSwitcher.tsx` lines 38-48
**Category:** Performance
**Description:** The `fetchUsers` effect has `[modalState]` in its dependency array. This means users are re-fetched from Supabase every time the modal state transitions (e.g., `closed` -> `pin`, `pin` -> `closed`). The user list does not change between these transitions.

```tsx
useEffect(() => {
  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, color, role, created_at, last_login')
      .order('name');
    if (data) {
      setUsers(data.map(u => ({ ...u, role: u.role || 'member' })));
    }
  };
  fetchUsers();
}, [modalState]);
```

**Impact:** Unnecessary Supabase queries on every modal open/close cycle. With PIN lockout, this could mean 3-4 extra fetches per login attempt.
**Suggested fix:** Change dependency to `[]` (fetch once on mount) or use a stale-while-revalidate pattern.

### BUG-008: NavigationSidebar uses deprecated navigator.platform API

**File:** `src/components/layout/NavigationSidebar.tsx` line 86
**Category:** Deprecation
**Description:** The component uses `navigator.platform.includes('Mac')` to determine the keyboard shortcut modifier key. `navigator.platform` is deprecated and will be removed from browsers in the future. It also does not work correctly in some environments (e.g., iPad with desktop mode reports as MacIntel).

```tsx
const shortcutKey = typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl';
```

**Impact:** Will break when browsers remove `navigator.platform`. Currently works but is a maintenance risk.
**Suggested fix:** Use `navigator.userAgentData?.platform` with fallback, or check `navigator.userAgent` for "Mac".

### BUG-009: AppShell Escape handler missing showWeeklyChart in dependency array

**File:** `src/components/layout/AppShell.tsx` lines 171-187
**Category:** Stale closure
**Description:** The keyboard shortcut useEffect closes various panels on Escape press in priority order. The dependency array includes `commandPaletteOpen`, `rightPanel`, `mobileSheetOpen`, and `showShortcuts`, but `showWeeklyChart` is not handled in the Escape sequence at all. If the weekly chart modal is open and the user presses Escape, the handler will not close it (the weekly chart has its own close mechanism, so this is a mild UX inconsistency rather than a functional break).

Additionally, the Escape handler uses a cascade: `if (showShortcuts) ... else if (commandPaletteOpen) ...`. If `showShortcuts` and `commandPaletteOpen` are both somehow true, only shortcuts closes. The dependency array is correct for the current logic, but the handler does not have a catch-all case.

**Impact:** Minor UX inconsistency - Escape behavior is not uniform across all overlays.
**Suggested fix:** Add `showWeeklyChart` to the Escape cascade if desired for consistent behavior.

### BUG-010: ActivityFeed fetchActivities has unstable reference from activities.length dependency

**File:** `src/components/ActivityFeed.tsx` line 264
**Category:** Stale closure / Performance
**Description:** The `fetchActivities` callback includes `activities.length` in its dependency array. This means the callback reference changes every time the activities array changes length. The `loadMore` callback (line 266-270) depends on `fetchActivities`, creating a cascade of re-renders. The initial fetch useEffect (line 272-275) suppresses the exhaustive-deps warning to avoid re-running on `fetchActivities` changes.

```tsx
}, [currentUserName, activities.length]);
// ...
useEffect(() => {
  fetchActivities(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentUserName]);
```

**Impact:** The `loadMore` callback is recreated on every activity list update, causing child components that receive it as a prop to re-render unnecessarily. The suppressed lint rule means the initial fetch won't re-run if `currentUserName` changes in a way that the linter would catch.
**Suggested fix:** Use a ref for `activities.length` to avoid including it in the dependency array, or use `useRef` to hold the current activities count for offset calculation.

### BUG-011: EnhancedBottomNav badge stats are hardcoded to zero

**File:** `src/components/layout/EnhancedBottomNav.tsx` lines 49-53
**Category:** Functionality
**Description:** The `stats` state for badge counts is initialized to zeros and never updated. The comment says "these would come from props or context in real implementation" but they remain static.

```tsx
const [stats, setStats] = useState({
  unreadMessages: 0,
  overdueTasks: 0,
  dueTodayTasks: 0,
});
```

**Impact:** The Messages tab badge never shows unread count on mobile bottom nav, even when there are unread messages. Users have no visual indicator of pending messages from the nav bar.
**Suggested fix:** Connect stats to the chat subscription or a shared context/store that tracks unread counts.

### BUG-012: TeamContext loadTeamDetails not in useEffect dependency array

**File:** `src/contexts/TeamContext.tsx` lines 150-169
**Category:** Stale closure
**Description:** The useEffect that loads saved team selection calls `loadTeamDetails` (line 159, 167) but does not include it in the dependency array. The effect depends on `[mounted, teams, isMultiTenancyEnabled]`. Since `loadTeamDetails` is defined as a `useCallback` (presumably with stable deps), this is likely safe in practice, but violates the exhaustive-deps rule and could become a problem if `loadTeamDetails` gains new dependencies.

Similarly, `loadUserTeams` on line 146 is called in a useEffect with `[resolvedUserId, isMultiTenancyEnabled]` but `loadUserTeams` itself is not in the dependency array.

**Impact:** Low risk currently since the callbacks appear stable, but any future refactoring that adds dependencies to these callbacks would create stale closure bugs that are hard to diagnose.
**Suggested fix:** Include `loadTeamDetails` and `loadUserTeams` in their respective dependency arrays.

### BUG-013: LoginScreen auto-submit PIN effect has suppressed exhaustive-deps

**File:** `src/components/LoginScreen.tsx` lines 324-329
**Category:** Stale closure
**Description:** The auto-submit effect includes `isSubmitting` and `lockoutSeconds` in its condition (line 325) but the eslint-disable suppresses the exhaustive-deps warning. Unlike the UserSwitcher version (which omits these from deps), this version actually includes them in the dependency array (line 329), making it more correct. However, `handlePinSubmit` is called but not in the dependency array.

```tsx
useEffect(() => {
  if (screen === 'pin' && pin.every((d) => d !== '') && !isSubmitting && selectedUser && lockoutSeconds === 0) {
    handlePinSubmit();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pin, screen, selectedUser, isSubmitting, lockoutSeconds]);
```

**Impact:** If `handlePinSubmit` captures stale values in its closure (e.g., stale `selectedUser` or `pin`), the submitted data could be wrong. In practice, since `selectedUser` and `pin` are both in the deps array and trigger the effect, this is likely safe for the current code.
**Suggested fix:** Wrap `handlePinSubmit` in `useCallback` with proper deps and include it in the effect's dependency array, or extract the verification logic to avoid the closure issue.

### BUG-014: TeamContext currentMembership comparison uses reference equality

**File:** `src/contexts/TeamContext.tsx` lines 171-179
**Category:** Performance / Correctness
**Description:** The effect that syncs `currentMembership` from the `teams` array uses `!==` reference equality:

```tsx
if (updatedMembership && updatedMembership !== currentMembership) {
  setCurrentMembership(updatedMembership);
}
```

If the `teams` array is reconstructed (e.g., from a re-fetch or state update), `updatedMembership` will be a new object reference even if the data is identical, causing `setCurrentMembership` to fire and trigger a re-render of all consumers.

**Impact:** Unnecessary re-renders of TeamContext consumers when teams array is refreshed but membership data hasn't actually changed.
**Suggested fix:** Use a deep equality check or compare specific fields (e.g., `role`, `team_id`, `status`).

---

## Low

### BUG-015: CommandPalette has unused openRightPanel in useMemo dependency array

**File:** `src/components/layout/CommandPalette.tsx` line 187
**Category:** Performance (minor)
**Description:** `openRightPanel` is included in the `useMemo` dependency array for the `commands` list but is never used in any command's action handler. This means changes to `openRightPanel` (which is already a stable `useCallback`) would unnecessarily recompute the commands array.

```tsx
], [darkMode, toggleTheme, setActiveView, openRightPanel, onClose, openShortcuts, triggerNewTask]);
```

**Impact:** Negligible performance impact since `openRightPanel` is a stable reference. This is a code hygiene issue.
**Suggested fix:** Remove `openRightPanel` from the dependency array, or add a command that uses it.

### BUG-016: UserSetup floating label uses hardcoded background colors

**File:** `src/components/UserSetup.tsx`
**Category:** Dark mode (cosmetic)
**Description:** The floating label animation uses `bg-white dark:bg-slate-900` for the label background, which may not exactly match the input container background if the app uses CSS variables for surfaces.

**Impact:** Very minor visual mismatch - the floating label background might be slightly different from the surrounding area in some theme configurations.
**Suggested fix:** Use CSS variable-based backgrounds for consistency.

### BUG-017: TeamSwitcher uses hardcoded Tailwind dark colors instead of CSS variables

**File:** `src/components/TeamSwitcher.tsx`
**Category:** Dark mode consistency
**Description:** The TeamSwitcher dropdown uses Tailwind's built-in dark mode classes (`dark:bg-gray-800`, `dark:text-gray-300`, etc.) rather than the CSS custom property system (`var(--surface)`, `var(--text)`) used by most other components. This works functionally but creates an inconsistency in how dark mode is implemented across the app.

**Impact:** If the CSS variables are ever changed to implement custom themes, TeamSwitcher will not follow the new colors.
**Suggested fix:** Migrate to CSS variable-based colors for consistency with the rest of the app.

### BUG-018: FloatingChat.tsx appears to be a dead/legacy component

**File:** `src/components/FloatingChat.tsx`
**Category:** Code hygiene
**Description:** `FloatingChat.tsx` is a full floating chat widget component, but `AppShell.tsx` imports and uses `FloatingChatButton.tsx` instead. The two components serve overlapping purposes. FloatingChat may be unused (dead code).

**Impact:** No runtime impact if not imported anywhere, but increases bundle analysis noise and maintenance burden.
**Suggested fix:** Verify whether FloatingChat is imported anywhere. If not, remove it or mark it as deprecated.

### BUG-019: EnhancedBottomNav "Add" button navigates to tasks but does not trigger add-task

**File:** `src/components/layout/EnhancedBottomNav.tsx` lines 84-88
**Category:** Functionality
**Description:** The center "Add" button in the bottom nav calls `setActiveView('tasks')` but does not call `triggerNewTask()` which is available from the `useAppShell()` context. There is a TODO comment acknowledging this. As a result, tapping the prominent "+" button navigates to the tasks view but does not open the add-task modal.

```tsx
if (tabId === 'add') {
  setActiveView('tasks');
  // TODO: Trigger add task focus
}
```

**Impact:** The most prominent action button on mobile does not perform its intended action. Users must tap "+" then separately find the add-task input.
**Suggested fix:** Call `triggerNewTask()` after `setActiveView('tasks')`.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 5     |
| Medium   | 8     |
| Low      | 5     |
| **Total**| **19** |

### Top Priorities
1. **BUG-001** (Critical): Audit RLS policies on `todos` and `users` tables to confirm anonymous reads are blocked.
2. **BUG-002** (High): Fix the bottom nav dark mode background opacity - it is visually broken on every mobile dark mode session.
3. **BUG-005** (High): The PIN modal dark mode issue affects every user switching action in dark mode.
4. **BUG-003** (High): Non-functional buttons in TaskBottomSheet erode user trust on mobile.
5. **BUG-006** (High): Missing Escape/click-outside on team confirmation dialogs is a usability gap.
