# Comprehensive UI/UX Changes List

## HIGH PRIORITY

### 1. Remove Duplicate Navigation Items
**Location:** `src/components/layout/NavigationSidebar.tsx` (hamburger menu section)
**Issue:** Archive and Activity appear in BOTH the sidebar nav AND the hamburger dropdown menu
**Change:** Remove Archive and Activity from the hamburger menu dropdown only

### 2. Simplify Filter Row with Overflow Menu
**Location:** `src/components/TodoList.tsx` (filter row)
**Issue:** Filter row has too many buttons causing clutter
**Change:** Create a "More" overflow dropdown containing Templates, Select, and Sections buttons

### 3. Combine Dual Headers
**Location:** `src/components/TodoList.tsx` and `src/components/todo/TodoHeader.tsx`
**Issue:** Two separate header rows create visual clutter
**Change:** Merge into single unified header with proper grouping

### 4. Notification Improvements
**Location:** `src/components/layout/NavigationSidebar.tsx` (notification dropdown)
**Issue:** No way to mark all notifications as read at once
**Change:** Add "Mark all as read" button to notification dropdown header

---

## MEDIUM PRIORITY

### 5. Sections Button in Board View
**Location:** `src/components/TodoList.tsx`
**Issue:** Sections toggle disappears when switching to Kanban/Board view
**Change:** Keep Sections button visible (or show alternative board organization controls)

### 6. Resizable Chat Panel
**Location:** `src/components/chat/ChatPanel.tsx`
**Issue:** Chat panel has fixed width, can't be resized
**Change:** Add drag-to-resize functionality or width presets

### 7. Task Card Information Density
**Location:** `src/components/todo/TaskCard.tsx`
**Issue:** Task cards show too much metadata on mobile
**Change:** Hide secondary metadata (assignee, dates) on mobile, show on hover/tap

### 8. Activity Feed Badge
**Location:** `src/components/layout/NavigationSidebar.tsx`
**Issue:** No indicator for new activity
**Change:** Add unread count badge to Activity nav item

---

## LOW PRIORITY

### 9. Dashboard Modal Auto-Open
**Location:** `src/components/dashboard/StrategicDashboard.tsx`
**Issue:** Dashboard modal opens automatically on every login
**Change:** Add "Don't show on login" checkbox preference

### 10. Theme Toggle Redundancy
**Location:** `src/components/layout/NavigationSidebar.tsx`
**Issue:** Theme toggle appears in BOTH sidebar and hamburger menu
**Change:** Remove theme toggle from hamburger menu (keep only in sidebar)

### 11. Empty States Enhancement
**Location:** Various components (TodoList, ChatPanel, etc.)
**Issue:** Empty states are plain text
**Change:** Add illustrations and helpful action buttons

### 12. Keyboard Shortcuts Discoverability
**Location:** Global
**Issue:** Keyboard shortcuts exist but aren't discoverable
**Change:** Add "?" shortcut to show keyboard shortcuts modal

---

## Implementation Status

- [ ] HIGH-1: Remove duplicate nav items
- [ ] HIGH-2: Filter row overflow menu
- [ ] HIGH-3: Combine dual headers
- [ ] HIGH-4: Notification mark all read
- [ ] MEDIUM-5: Sections in board view
- [ ] MEDIUM-6: Resizable chat panel
- [ ] MEDIUM-7: Task card density
- [ ] MEDIUM-8: Activity badge
- [ ] LOW-9: Dashboard auto-open option
- [ ] LOW-10: Theme toggle redundancy
- [ ] LOW-11: Empty states
- [ ] LOW-12: Keyboard shortcuts modal
