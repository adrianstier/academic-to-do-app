'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { Todo, AuthUser, CelebrationData, Subtask } from '@/types/todo';
import { DuplicateMatch } from '@/lib/duplicateDetection';
import CelebrationEffect from '../CelebrationEffect';
import ProgressSummary from '../ProgressSummary';
import WelcomeBackNotification from '../WelcomeBackNotification';
import ConfirmDialog from '../ConfirmDialog';
import KeyboardShortcutsModal from '../KeyboardShortcutsModal';
import AddTaskModal from '../AddTaskModal';
import SaveTemplateModal from '../SaveTemplateModal';
import ArchivedTaskModal from '../ArchivedTaskModal';
import DuplicateDetectionModal from '../DuplicateDetectionModal';
import CustomerEmailModal from '../CustomerEmailModal';
import { CompletionCelebration } from '../CompletionCelebration';
import { TaskCompletionSummary } from '../TaskCompletionSummary';
import {
  WeeklyProgressChartSkeleton,
} from '../LoadingSkeletons';

// Lazy load WeeklyProgressChart
const WeeklyProgressChart = dynamic(() => import('../WeeklyProgressChart'), {
  ssr: false,
  loading: () => <WeeklyProgressChartSkeleton />,
});

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface PendingTask {
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: string;
  subtasks?: Subtask[];
  transcription?: string;
  sourceFile?: File;
}

interface TodoModalsProps {
  // Current user
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;

  // Theme
  darkMode: boolean;

  // Todos for various modals
  todos: Todo[];
  visibleTodos: Todo[];
  users: string[];

  // Celebration
  showCelebration: boolean;
  celebrationText: string;
  dismissCelebration: () => void;
  showEnhancedCelebration: boolean;
  celebrationData: CelebrationData | null;
  dismissEnhancedCelebration: () => void;

  // Progress & Welcome
  showProgressSummary: boolean;
  closeProgressSummary: () => void;
  showWelcomeBack: boolean;
  closeWelcomeBack: () => void;
  openProgressSummary: () => void;

  // Weekly Chart
  showWeeklyChart: boolean;
  closeWeeklyChart: () => void;

  // Confirm Dialog
  confirmDialog: ConfirmDialogState;
  closeConfirmDialog: () => void;

  // Shortcuts
  showShortcuts: boolean;
  closeShortcuts: () => void;

  // Add Task Modal
  showAddTaskModal: boolean;
  setShowAddTaskModal: (show: boolean) => void;
  onAddTodo: (
    text: string,
    priority: 'low' | 'medium' | 'high' | 'urgent',
    dueDate?: string,
    assignedTo?: string,
    subtasks?: { id: string; text: string; completed: boolean }[],
    transcription?: string,
    sourceFile?: File,
    reminderAt?: string,
    notes?: string,
    recurrence?: 'daily' | 'weekly' | 'monthly' | null
  ) => void;

  // Template
  templateTodo: Todo | null;
  closeTemplateModal: () => void;
  onSaveAsTemplate: (name: string, isShared: boolean) => Promise<void>;

  // Completion Summary
  showCompletionSummary: boolean;
  completedTaskForSummary: Todo | null;
  closeCompletionSummary: () => void;
  openCompletionSummary: (todo: Todo) => void;
  userName: string;

  // Duplicate Detection
  showDuplicateModal: boolean;
  pendingTask: PendingTask | null;
  duplicateMatches: DuplicateMatch[];
  onCreateTaskAnyway: () => void;
  onAddToExistingTask: (existingTodoId: string) => void;
  onCancelDuplicateDetection: () => void;

  // Email
  showEmailModal: boolean;
  emailTargetTodos: Todo[];
  closeEmailModal: () => void;

  // Archived Task Detail
  selectedArchivedTodo: Todo | null;
  selectArchivedTodo: (todo: Todo | null) => void;

  // Next task callback for celebration
  onNextTaskClick: (taskId: string) => void;
}

function TodoModals({
  currentUser,
  onUserChange,
  darkMode,
  todos,
  visibleTodos,
  users,
  showCelebration,
  celebrationText,
  dismissCelebration,
  showEnhancedCelebration,
  celebrationData,
  dismissEnhancedCelebration,
  showProgressSummary,
  closeProgressSummary,
  showWelcomeBack,
  closeWelcomeBack,
  openProgressSummary,
  showWeeklyChart,
  closeWeeklyChart,
  confirmDialog,
  closeConfirmDialog,
  showShortcuts,
  closeShortcuts,
  showAddTaskModal,
  setShowAddTaskModal,
  onAddTodo,
  templateTodo,
  closeTemplateModal,
  onSaveAsTemplate,
  showCompletionSummary,
  completedTaskForSummary,
  closeCompletionSummary,
  openCompletionSummary,
  userName,
  showDuplicateModal,
  pendingTask,
  duplicateMatches,
  onCreateTaskAnyway,
  onAddToExistingTask,
  onCancelDuplicateDetection,
  showEmailModal,
  emailTargetTodos,
  closeEmailModal,
  selectedArchivedTodo,
  selectArchivedTodo,
  onNextTaskClick,
}: TodoModalsProps) {
  return (
    <>
      <CelebrationEffect
        show={showCelebration}
        onComplete={dismissCelebration}
        taskText={celebrationText}
      />

      <ProgressSummary
        show={showProgressSummary}
        onClose={closeProgressSummary}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <WelcomeBackNotification
        show={showWelcomeBack}
        onClose={closeWelcomeBack}
        onViewProgress={openProgressSummary}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmDialog}
      />

      {/* Only render when shown to prevent skeleton flash during dynamic import */}
      {showWeeklyChart && (
        <WeeklyProgressChart
          todos={visibleTodos}
          darkMode={darkMode}
          show={showWeeklyChart}
          onClose={closeWeeklyChart}
        />
      )}

      <KeyboardShortcutsModal
        show={showShortcuts}
        onClose={closeShortcuts}
        darkMode={darkMode}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onAdd={onAddTodo}
        users={users}
        darkMode={darkMode}
        currentUserId={currentUser.id}
      />

      {/* Save Template Modal */}
      {templateTodo && (
        <SaveTemplateModal
          todo={templateTodo}
          darkMode={darkMode}
          onClose={closeTemplateModal}
          onSave={onSaveAsTemplate}
        />
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicateModal && pendingTask && (
        <DuplicateDetectionModal
          isOpen={showDuplicateModal}
          darkMode={darkMode}
          newTaskText={pendingTask.text}
          newTaskPriority={pendingTask.priority}
          newTaskDueDate={pendingTask.dueDate}
          newTaskAssignedTo={pendingTask.assignedTo}
          newTaskSubtasks={pendingTask.subtasks}
          newTaskTranscription={pendingTask.transcription}
          duplicates={duplicateMatches}
          onCreateAnyway={onCreateTaskAnyway}
          onAddToExisting={onAddToExistingTask}
          onCancel={onCancelDuplicateDetection}
        />
      )}

      {/* Customer Email Modal */}
      {showEmailModal && emailTargetTodos.length > 0 && (
        <CustomerEmailModal
          todos={emailTargetTodos}
          currentUser={currentUser}
          onClose={closeEmailModal}
          darkMode={darkMode}
        />
      )}

      {/* Enhanced Celebration Modal */}
      {showEnhancedCelebration && celebrationData && (
        <CompletionCelebration
          celebrationData={celebrationData}
          onDismiss={dismissEnhancedCelebration}
          onNextTaskClick={(taskId) => {
            dismissEnhancedCelebration();
            onNextTaskClick(taskId);
          }}
          onShowSummary={() => {
            openCompletionSummary(celebrationData.completedTask);
          }}
        />
      )}

      {/* Task Completion Summary Modal */}
      {showCompletionSummary && completedTaskForSummary && (
        <TaskCompletionSummary
          todo={completedTaskForSummary}
          completedBy={userName}
          onClose={closeCompletionSummary}
        />
      )}

      {/* Archived Task Detail Modal */}
      {selectedArchivedTodo && (
        <ArchivedTaskModal
          todo={selectedArchivedTodo}
          onClose={() => selectArchivedTodo(null)}
        />
      )}
    </>
  );
}

export default memo(TodoModals);
