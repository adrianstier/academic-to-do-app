# Bug Bash Plan

## Scope Splits (6 parallel agents)

### 1. `api-routes` - All API Routes + Auth/Security Libs
- `src/app/api/**` (15 route dirs)
- `src/lib/teamAuth.ts`, `apiAuth.ts`, `rateLimit.ts`, `csrf.ts`
- `src/lib/secureAuth.ts`, `securityMonitor.ts`, `serverLockout.ts`, `sessionValidator.ts`
- `src/lib/fieldEncryption.ts`, `promptSanitizer.ts`, `sanitize.ts`
- Focus: auth bypasses, missing team scoping, injection, rate limit gaps, error leaks

### 2. `task-management` - Core Task CRUD + TodoList + Modals
- `src/components/TodoList.tsx`, `TodoItem.tsx`, `AddTodo.tsx`, `AddTaskModal.tsx`
- `src/components/todo/*` (TodoModals, BulkActionBar, TodoHeader, etc.)
- `src/components/KanbanBoard.tsx`, `SortableTodoItem.tsx`, `SwipeableTodoItem.tsx`
- `src/components/SmartParseModal.tsx`, `DuplicateDetectionModal.tsx`, `TemplatePicker.tsx`
- `src/components/FileImporter.tsx`, `ContentToSubtasksImporter.tsx`
- `src/hooks/useTodoModals.ts`, `useTodoData.ts`, `useFilters.ts`, `useBulkActions.ts`
- `src/store/todoStore.ts`
- Focus: stale closures, broken callbacks, data loss, duplicate bugs, state sync

### 3. `task-detail` - Task Detail Panel/Modal + Subtask/Attachment/Notes
- `src/components/task-detail/*` (TaskDetailModal, MetadataSection, SubtasksSection, etc.)
- `src/components/layout/TaskDetailPanel.tsx`, `TaskCard.tsx`
- `src/components/AttachmentList.tsx`, `AttachmentUpload.tsx`
- `src/components/ReminderPicker.tsx`, `SaveTemplateModal.tsx`
- Focus: prop mismatches, broken controls, missing handlers, a11y, dark mode

### 4. `dashboard-views` - Dashboards + Views + Analytics
- `src/components/dashboard/*` (DoerDashboard, ManagerDashboard, StatCard, etc.)
- `src/components/DashboardModal.tsx`, `Dashboard.tsx`, `StrategicDashboard.tsx`
- `src/components/views/*` (DashboardPage, AIInbox, ChatView)
- `src/components/ProgressSummary.tsx`, `WeeklyProgressChart.tsx`
- `src/components/ArchiveView.tsx`, `ArchivedTaskModal.tsx`
- `src/lib/dashboardUtils.ts`, `aiDashboardInsights.ts`, `managerDashboardInsights.ts`
- Focus: wrong data, timezone bugs, dead buttons, chart issues, dark mode

### 5. `layout-navigation` - App Shell + Navigation + Chat + Team Mgmt
- `src/components/layout/*` (AppShell, CommandPalette, NavigationSidebar, etc.)
- `src/components/LoginScreen.tsx`, `UserSetup.tsx`, `UserSwitcher.tsx`, `TeamSwitcher.tsx`
- `src/components/TeamManagement/*`
- `src/components/TeamOnboardingModal.tsx`
- `src/components/FloatingChat.tsx`, `FloatingChatButton.tsx`, `ChatPanel.tsx`
- `src/components/chat/*`
- `src/components/ActivityFeed.tsx`
- `src/contexts/*`, `src/components/AuthProvider.tsx`
- Focus: navigation bugs, auth flows, stale state, permission checks, responsive

### 6. `shared-libs-hooks` - Shared Libraries + Hooks + UI Primitives
- `src/lib/*` (all non-auth libs: animations, logger, duplicateDetection, etc.)
- `src/hooks/*` (all hooks)
- `src/components/ui/*` (all UI primitives)
- `src/types/*`
- `src/components/ErrorBoundary.tsx`, `ConfirmDialog.tsx`, `Celebration*.tsx`
- Focus: type safety, edge cases, memory leaks, missing error handling, a11y

## Process
1. Spawn all 6 scope agents in parallel
2. Each agent: reads all files in scope, identifies bugs, writes report
3. Spawn review agent to cross-check reports and run build
4. Fix all found issues, commit, push
