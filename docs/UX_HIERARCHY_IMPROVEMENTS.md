# UX Hierarchy Improvements Plan

Based on professional UI/UX designer critique focusing on clarity, hierarchy, usability, and product maturity.

---

## Executive Summary

**Current Score: 8/10** - The interface is polished and credible, but over-weighted toward aesthetics at the expense of cognitive efficiency.

**Core Problem:** Everything has the same visual weight. Task cards, summary cards, quick add, and filters all feel equally important. The user's eye doesn't immediately land on what they should do next.

**Design Principle:** This is a task-heavy product about *action*, not browsing. It should feel like a **command center**, not a dashboard.

---

## Priority Issues & Solutions

### 1. HIERARCHY PROBLEM (HIGH PRIORITY)

**Issue:** No clear visual ladder. Everything competes for attention.

**Solution:** Create three-tier hierarchy:
1. **Primary** - What should I do now? (Task list, urgent items)
2. **Secondary** - Context (counts, filters, status)
3. **Tertiary** - Controls (templates, settings, rarely-used features)

**Implementation:**
- Reduce visual prominence of "Templates" button
- Compress "Quick Add" suggested tasks (less height, lighter background)
- Make Overdue tasks visually dominant when count > 0

---

### 2. TASK CARDS NOT SCANNABLE (HIGH PRIORITY)

**Issue:** Low contrast, similar backgrounds, priority not instantly obvious.

**Current State (TodoItem.tsx):**
- Container: `bg-[var(--surface)] border-[var(--border)]`
- Title: `font-medium text-[var(--foreground)]`
- Priority: Inline colored badge only
- Left-edge bar: Only for medium-priority overdue tasks

**Solution:**
- Add **left-edge priority color bar** to ALL tasks (not just overdue)
- Increase title font weight to `font-semibold`
- Add subtle background tint based on priority
- Increase contrast between task and container

**Code Changes (src/components/TodoItem.tsx):**

```typescript
// Line ~305-330: Update getCardStyle() function
const getCardStyle = () => {
  // Get priority-based left border
  const priorityBorder = getPriorityBorderClass();

  if (todo.completed) {
    return `bg-[var(--surface)] border-[var(--border-subtle)] opacity-60 ${priorityBorder}`;
  }
  if (selected) {
    return `border-[var(--accent)] bg-[var(--accent-light)] ${priorityBorder}`;
  }
  if (dueDateStatus === 'overdue') {
    const isHighPriority = priority === 'urgent' || priority === 'high';
    if (isHighPriority) {
      return `bg-red-500/10 border-red-500/30 ${priorityBorder}`;
    }
  }
  return `bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)] ${priorityBorder}`;
};

// NEW: Add priority border helper
const getPriorityBorderClass = () => {
  switch (priority) {
    case 'urgent': return 'border-l-4 border-l-red-500';
    case 'high': return 'border-l-4 border-l-orange-500';
    case 'medium': return 'border-l-4 border-l-yellow-500';
    case 'low': return 'border-l-4 border-l-blue-400';
    default: return 'border-l-4 border-l-slate-300';
  }
};
```

```typescript
// Line ~381-390: Update title styling
<p
  className={`font-semibold cursor-pointer line-clamp-2 ${
    todo.completed
      ? 'text-[var(--text-light)] line-through'
      : 'text-[var(--foreground)]'
  }`}
>
```

---

### 3. PRIMARY INPUT UNDERVALUED (MEDIUM PRIORITY)

**Issue:** The "Add a task" input is visually buried - the most important action feels secondary.

**Current State (AddTodo.tsx):**
- Height: `min-h-[48px]`
- Padding: `px-4 py-3`
- Font: `text-sm`
- Border: Standard `border-[var(--border)]`

**Solution:**
- Increase minimum height to 56px
- Increase padding for more breathing room
- Use base font size instead of small
- Add subtle accent border or background
- Consider sticky positioning when scrolling

**Code Changes (src/components/AddTodo.tsx):**

```typescript
// Line ~492-506: Update textarea styling
className={`input-refined w-full px-4 py-4 pr-10 resize-none text-base min-h-[56px] text-[var(--foreground)] placeholder-[var(--text-light)] ${
  isRecording ? 'border-[var(--danger)] ring-2 ring-[var(--danger-light)]' : ''
}`}

// Line ~464-471: Update container styling
className={`rounded-[var(--radius-xl)] border-2 shadow-[var(--shadow-md)] overflow-hidden transition-all duration-300 relative bg-[var(--surface)] border-[var(--accent)]/30 ${
  isDraggingFile ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : 'hover:shadow-[var(--shadow-lg)] hover:border-[var(--accent)]/50 focus-within:border-[var(--accent)] focus-within:shadow-[var(--shadow-lg)]'
}`}
```

---

### 4. QUICK ADD VISUALLY NOISY (MEDIUM PRIORITY)

**Issue:** Template suggestions look like real tasks, causing confusion.

**Current State (TemplatePicker.tsx):**
- Same styling as task cards
- Full opacity
- No visual indicator of "suggested" status
- No border differentiation

**Solution:**
- Add dashed border to templates
- Reduce opacity to 75%
- Add "Suggested" label badge
- Use lighter background

**Code Changes (src/components/TemplatePicker.tsx):**

```typescript
// Line ~374-376: Update TemplateItem container
className={`w-full px-4 py-3 text-left transition-colors flex items-start gap-3 group border border-dashed rounded-lg opacity-80 ${
  darkMode
    ? 'border-slate-600/50 hover:bg-slate-700/30 hover:opacity-100'
    : 'border-slate-300/70 hover:bg-slate-50 hover:opacity-100'
}`}

// Line ~388: Add "Suggested" badge after title
<span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${
  darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
}`}>
  Template
</span>
```

---

### 5. FILTER BAR TOO DENSE (MEDIUM PRIORITY)

**Issue:** Visually heavy for how often it's used. All controls compete equally.

**Current State (TodoList.tsx lines 1527-1751):**
- Search + Sort always visible
- 5-6 quick filter controls always visible
- Advanced filters collapsible (already good)

**Solution:**
- Keep Search always visible (highest priority)
- Keep High Priority toggle visible (urgency signaling)
- Move Sort, Show Completed behind "More" or into advanced
- Reduce button padding slightly
- Add visual separation between tiers

**Code Changes (src/components/TodoList.tsx):**

```typescript
// Line ~1590-1602: Reduce High Priority button padding
className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${...}`}

// Line ~1605-1617: Reduce Show Completed button padding
className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${...}`}
```

---

## Implementation Phases

### Phase 1: Task Card Scannability (High Impact)
**Files:** `src/components/TodoItem.tsx`
**Changes:**
- [ ] Add `getPriorityBorderClass()` helper function
- [ ] Update `getCardStyle()` to include priority border
- [ ] Change title from `font-medium` to `font-semibold`
- [ ] Test all priority levels display correctly

### Phase 2: Primary Input Prominence (Medium Impact)
**Files:** `src/components/AddTodo.tsx`
**Changes:**
- [ ] Increase min-height from 48px to 56px
- [ ] Increase padding from py-3 to py-4
- [ ] Change font from text-sm to text-base
- [ ] Add accent border styling
- [ ] Add focus-within enhancement

### Phase 3: Template Visual Distinction (Medium Impact)
**Files:** `src/components/TemplatePicker.tsx`
**Changes:**
- [ ] Add dashed border to template items
- [ ] Add opacity-80 default, opacity-100 on hover
- [ ] Add "Template" badge label
- [ ] Adjust background colors

### Phase 4: Filter Bar Simplification (Low Impact)
**Files:** `src/components/TodoList.tsx`
**Changes:**
- [ ] Reduce button padding (py-2 → py-1.5)
- [ ] Add visual tier separation
- [ ] Consider moving Sort to advanced filters

---

## Testing Checklist

After implementation, verify:

### Task Cards
- [ ] All priority levels show correct left-edge color bar
- [ ] Urgent: Red bar
- [ ] High: Orange bar
- [ ] Medium: Yellow bar
- [ ] Low: Blue bar
- [ ] No priority: Slate/gray bar
- [ ] Completed tasks maintain opacity treatment
- [ ] Selected tasks show accent styling with priority bar
- [ ] Overdue high-priority tasks show red background + bar

### Primary Input
- [ ] Input is visually more prominent than before
- [ ] Focus state shows enhanced border/shadow
- [ ] Placeholder text is readable
- [ ] Recording state still shows red ring
- [ ] Mobile touch targets still adequate (min 48px)

### Templates
- [ ] Templates clearly distinguished from real tasks
- [ ] Dashed border visible
- [ ] "Template" badge appears
- [ ] Hover increases opacity
- [ ] Still fully functional for selection

### Filter Bar
- [ ] All filters still work correctly
- [ ] Visual density reduced
- [ ] High Priority toggle prominent
- [ ] Search remains prominent
- [ ] Mobile layout not broken

### General
- [ ] Dark mode works correctly
- [ ] Light mode works correctly
- [ ] No accessibility regressions
- [ ] Build passes without errors
- [ ] No console errors

---

## Design Tokens Used

All changes use existing CSS variables from `globals.css`:

| Variable | Usage |
|----------|-------|
| `--surface` | Card backgrounds |
| `--surface-2` | Secondary backgrounds |
| `--border` | Default borders |
| `--border-subtle` | Muted borders |
| `--accent` | Primary accent color |
| `--foreground` | Primary text |
| `--text-muted` | Secondary text |
| `--text-light` | Tertiary text |
| `--radius-md` | Medium border radius |
| `--radius-xl` | Large border radius |
| `--shadow-sm/md/lg` | Shadow levels |

---

## Rollback Plan

If issues arise:
1. All changes are additive CSS classes
2. Git revert to previous commit
3. No database or API changes required
4. Feature flag not needed (pure CSS/styling changes)

---

*Created: 2026-01-18*
*Status: Ready for Implementation*
