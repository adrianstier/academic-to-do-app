# UX Feature Preservation Guide

This document ensures no features are lost during the header reorganization.

---

## Current Feature Inventory

### Header Buttons (8-10 total)

| Feature | Current Location | Daily Use? | Proposed Location | Keyboard Shortcut |
|---------|------------------|------------|-------------------|-------------------|
| Dashboard | Left header | Yes | Keep visible | - |
| List/Board Toggle | Center header | Yes | **Keep visible** | - |
| Activity Feed | Right header | Weekly | Move to menu | - |
| Archive View | Right header | Rarely | Move to menu | - |
| Strategic Goals | Right header | Weekly | Move to menu | - |
| Weekly Chart | Right header | Weekly | Move to menu | - |
| Theme Toggle | Right header | Rarely | Move to menu | - |
| User Switcher | Far right | Per session | **Keep visible** (simplified) | - |

### Filter Controls (5 total)

| Feature | Current Location | Daily Use? | Proposed Location | Keyboard Shortcut |
|---------|------------------|------------|-------------------|-------------------|
| Search | Filter bar | Yes | **Keep visible** | `/` |
| Sort Dropdown | Filter bar | Yes | **Keep visible** | - |
| Quick Filter | Filter bar | Yes | **Bottom tabs** | `1-4` |
| High Priority Toggle | Filter bar | Yes | **Keep visible** | - |
| Show Completed | Filter bar | Yes | **Keep visible** | - |
| Advanced Filters | Filter bar | Weekly | Collapse by default | - |

### Stats Cards (3 total)

| Feature | Current Location | Proposed |
|---------|------------------|----------|
| To Do count | Stats grid | **Status line** (combined) |
| Due Today count | Stats grid | **Status line** (combined) |
| Overdue count | Stats grid | **Status line** (combined) |

---

## Feature Access Matrix

### All Users Can Access:
- [x] View mode toggle (List/Board)
- [x] Search
- [x] Sort
- [x] Quick filters (All, My Tasks, Due Today, Overdue)
- [x] High priority toggle
- [x] Show completed toggle
- [x] Advanced filters (Status, Assigned, Customer, Attachments, Date Range)
- [x] Activity Feed
- [x] Weekly Progress Chart
- [x] Theme Toggle
- [x] User Switcher
- [x] Bulk Actions
- [x] Keyboard Shortcuts

### Owner Only (Derrick):
- [x] Strategic Goals Dashboard
- [x] Archive View (also Adrian + admins)

---

## Keyboard Shortcuts (Must Preserve)

| Key | Action | Status |
|-----|--------|--------|
| `N` | New task | Keep |
| `/` | Search | Keep |
| `Escape` | Clear/close | Keep |
| `1` | All tasks | Keep |
| `2` | My tasks | Keep |
| `3` | Due today | Keep |
| `4` | Overdue | Keep |
| `?` | Show shortcuts | Keep |

---

## Reorganization Plan

### Keep in Header (Always Visible)

```
┌────────────────────────────────────────────────────────────┐
│  [🏠] Logo    [List|Board]    [Search...]    [User] [≡]   │
└────────────────────────────────────────────────────────────┘
```

1. **Dashboard/Home button** - Quick return to overview
2. **List/Board toggle** - Core daily action
3. **Search input** - Collapsed on mobile, expands on tap
4. **User indicator** - Shows current user, tap to switch
5. **Hamburger menu** - Access to all other features

### Move to Hamburger Menu

```
┌─────────────────────────────┐
│  ≡  Menu                    │
├─────────────────────────────┤
│  📊 Activity Feed           │
│  📈 Weekly Progress         │
│  🎯 Strategic Goals  (owner)│
│  📁 Archive          (admin)│
│  ─────────────────────────  │
│  🌙 Dark Mode         [ON]  │
│  ⌨️ Keyboard Shortcuts      │
│  ─────────────────────────  │
│  🔧 Advanced Filters        │
│  🔄 Reset All Filters       │
└─────────────────────────────┘
```

### Replace Stats Cards with Status Line

**Before:**
```
┌─────────┐ ┌─────────┐ ┌─────────┐
│ 15 Todo │ │ 3 Today │ │ 2 Over  │
└─────────┘ └─────────┘ └─────────┘
```

**After:**
```
15 active • 3 due today • 2 overdue
```

### Add Bottom Tabs (Mobile)

```
┌─────────────────────────────────────┐
│  [Today (3)] [All (15)] [Done (12)] │
└─────────────────────────────────────┘
```

Replaces quick filter dropdown with thumb-friendly tabs.

---

## Conditional Feature Preservation

### Strategic Goals (Owner Only)
```typescript
// Current check - MUST PRESERVE
{userName === OWNER_USERNAME && (
  <button onClick={() => setShowStrategicDashboard(true)}>
    <Target />
  </button>
)}

// In hamburger menu - SAME CHECK
{userName === OWNER_USERNAME && (
  <MenuItem onClick={() => setShowStrategicDashboard(true)}>
    Strategic Goals
  </MenuItem>
)}
```

### Archive View (Admin/Owner Only)
```typescript
// Current check - MUST PRESERVE
const canViewArchive = currentUser.role === 'admin' ||
  ['derrick', 'adrian'].includes(userName.toLowerCase());

{canViewArchive && (
  <MenuItem onClick={() => setShowArchiveView(true)}>
    Archive
  </MenuItem>
)}
```

---

## Migration Checklist

### Phase 1: Create Hamburger Menu
- [ ] Create `AppMenu.tsx` component
- [ ] Move Activity Feed button → menu item
- [ ] Move Weekly Chart button → menu item
- [ ] Move Strategic Goals button → menu item (preserve owner check)
- [ ] Move Archive button → menu item (preserve admin check)
- [ ] Move Theme toggle → menu item with switch
- [ ] Add Keyboard Shortcuts → menu item
- [ ] Add Advanced Filters → menu item (or keep in filter bar)

### Phase 2: Simplify Header
- [ ] Keep Dashboard button (left)
- [ ] Keep List/Board toggle (center-left)
- [ ] Add search (center, collapsible on mobile)
- [ ] Simplify User Switcher (show avatar/initial only)
- [ ] Add hamburger menu button (right)

### Phase 3: Replace Stats Cards
- [ ] Create `StatusLine.tsx` component
- [ ] Calculate active, dueToday, overdue counts
- [ ] Display as single line: "X active • Y due today • Z overdue"
- [ ] Make clickable segments (tap "due today" → filter to due today)

### Phase 4: Add Bottom Tabs (Mobile)
- [ ] Create `BottomTabs.tsx` component
- [ ] Add Today tab (filter: due_today)
- [ ] Add All tab (filter: all)
- [ ] Add Done tab (filter: completed)
- [ ] Show badge counts on each tab
- [ ] Hide on desktop (use quick filter dropdown instead)

---

## Testing Checklist

After reorganization, verify:

- [ ] Dashboard opens from home button
- [ ] List/Board toggle works
- [ ] Search works (including `/` shortcut)
- [ ] User can switch users
- [ ] Hamburger menu opens
- [ ] Activity Feed accessible from menu
- [ ] Weekly Chart accessible from menu
- [ ] Strategic Goals shows for Derrick only
- [ ] Archive shows for Derrick/Adrian only
- [ ] Theme toggle works
- [ ] All keyboard shortcuts work (N, /, Esc, 1-4, ?)
- [ ] Quick filters work (via bottom tabs on mobile)
- [ ] High priority toggle works
- [ ] Show completed toggle works
- [ ] Advanced filters work
- [ ] Bulk actions work
- [ ] Stats line shows correct counts
- [ ] Stats line segments are clickable

---

## Rollback Plan

If issues found:
1. Feature flag: `NEXT_PUBLIC_NEW_HEADER_UI=false`
2. Keep old header code in `TodoListHeaderLegacy.tsx`
3. Conditional render based on flag

```typescript
const { newHeaderUI } = useFeatureFlags();

return newHeaderUI ? (
  <NewHeader {...props} />
) : (
  <LegacyHeader {...props} />
);
```

---

*Last Updated: 2026-01-18*
