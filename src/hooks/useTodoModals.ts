/**
 * useTodoModals Hook
 *
 * Manages visibility state for all modals in the TodoList component.
 * Provides centralized modal state management with proper cleanup.
 *
 * This hook consolidates modal state that was previously scattered
 * across 20+ useState calls in TodoList.tsx.
 */

import { useState, useCallback } from 'react';
import { Todo, TodoPriority, Subtask, CelebrationData, ActivityLogEntry } from '@/types/todo';
import { DuplicateMatch } from '@/lib/duplicateDetection';

// ============================================
// Types & Interfaces
// ============================================

export interface UseTodoModalsOptions {
  /** Callback when any modal opens */
  onModalOpen?: (modalName: string) => void;
  /** Callback when any modal closes */
  onModalClose?: (modalName: string) => void;
}

export interface PendingTaskData {
  text: string;
  priority: TodoPriority;
  dueDate?: string;
  assignedTo?: string;
  subtasks?: Subtask[];
  transcription?: string;
  sourceFile?: File;
  reminderAt?: string;
  notes?: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | null;
  projectId?: string;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface UseTodoModalsReturn {
  // ============================================
  // Celebration State
  // ============================================
  showCelebration: boolean;
  celebrationText: string;
  showEnhancedCelebration: boolean;
  celebrationData: CelebrationData | null;

  // ============================================
  // Progress & Welcome State
  // ============================================
  showProgressSummary: boolean;
  showWelcomeBack: boolean;
  showWeeklyChart: boolean;

  // ============================================
  // Utility Modals State
  // ============================================
  showShortcuts: boolean;
  showActivityFeed: boolean;
  showStrategicDashboard: boolean;

  // ============================================
  // Template State
  // ============================================
  templateTodo: Todo | null;

  // ============================================
  // Confirm Dialog State
  // ============================================
  confirmDialog: ConfirmDialogState;

  // ============================================
  // Completion Summary State
  // ============================================
  showCompletionSummary: boolean;
  completedTaskForSummary: Todo | null;

  // ============================================
  // Duplicate Detection State
  // ============================================
  showDuplicateModal: boolean;
  duplicateMatches: DuplicateMatch[];
  pendingTask: PendingTaskData | null;

  // ============================================
  // Email Modal State
  // ============================================
  showEmailModal: boolean;
  emailTargetTodos: Todo[];

  // ============================================
  // Archive Modal State
  // ============================================
  showArchiveView: boolean;
  selectedArchivedTodo: Todo | null;
  archiveQuery: string;
  archiveTick: number;

  // ============================================
  // Merge Modal State
  // ============================================
  showMergeModal: boolean;
  mergeTargets: Todo[];
  selectedPrimaryId: string | null;
  isMerging: boolean;

  // ============================================
  // Activity Log State
  // ============================================
  activityLog: ActivityLogEntry[];

  // ============================================
  // Actions - Celebration
  // ============================================
  triggerCelebration: (text: string) => void;
  dismissCelebration: () => void;
  triggerEnhancedCelebration: (data: CelebrationData) => void;
  dismissEnhancedCelebration: () => void;

  // ============================================
  // Actions - Progress & Welcome
  // ============================================
  openProgressSummary: () => void;
  closeProgressSummary: () => void;
  openWelcomeBack: () => void;
  closeWelcomeBack: () => void;
  openWeeklyChart: () => void;
  closeWeeklyChart: () => void;

  // ============================================
  // Actions - Utility Modals
  // ============================================
  openShortcuts: () => void;
  closeShortcuts: () => void;
  openActivityFeed: () => void;
  closeActivityFeed: () => void;
  openStrategicDashboard: () => void;
  closeStrategicDashboard: () => void;

  // ============================================
  // Actions - Template
  // ============================================
  openTemplateModal: (todo: Todo) => void;
  closeTemplateModal: () => void;

  // ============================================
  // Actions - Confirm Dialog
  // ============================================
  openConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
  closeConfirmDialog: () => void;

  // ============================================
  // Actions - Completion Summary
  // ============================================
  openCompletionSummary: (todo: Todo) => void;
  closeCompletionSummary: () => void;

  // ============================================
  // Actions - Duplicate Detection
  // ============================================
  openDuplicateModal: (pendingTask: PendingTaskData, matches: DuplicateMatch[]) => void;
  closeDuplicateModal: () => void;
  clearDuplicateState: () => void;

  // ============================================
  // Actions - Email
  // ============================================
  openEmailModal: (todos: Todo[]) => void;
  closeEmailModal: () => void;

  // ============================================
  // Actions - Archive
  // ============================================
  openArchiveView: () => void;
  closeArchiveView: () => void;
  selectArchivedTodo: (todo: Todo | null) => void;
  setArchiveQuery: (query: string) => void;
  incrementArchiveTick: () => void;

  // ============================================
  // Actions - Merge
  // ============================================
  openMergeModal: (targets: Todo[]) => void;
  closeMergeModal: () => void;
  setMergePrimaryId: (id: string | null) => void;
  setMergingState: (isMerging: boolean) => void;

  // ============================================
  // Actions - Activity Log
  // ============================================
  setActivityLog: (log: ActivityLogEntry[]) => void;

  // ============================================
  // Utility Actions
  // ============================================
  closeAllModals: () => void;
}

const defaultConfirmDialog: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
};

/**
 * Hook that manages all modal visibility state for the TodoList component
 *
 * @param options - Configuration options
 * @returns Modal state and actions
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const {
 *     showShortcuts,
 *     openShortcuts,
 *     closeShortcuts,
 *     closeAllModals,
 *   } = useTodoModals();
 *
 *   return (
 *     <>
 *       <button onClick={openShortcuts}>Show Shortcuts</button>
 *       <KeyboardShortcutsModal show={showShortcuts} onClose={closeShortcuts} />
 *     </>
 *   );
 * }
 * ```
 */
export function useTodoModals(
  options: UseTodoModalsOptions = {}
): UseTodoModalsReturn {
  const { onModalOpen, onModalClose } = options;

  // ============================================
  // State - Celebration
  // ============================================
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  const [showEnhancedCelebration, setShowEnhancedCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  // ============================================
  // State - Progress & Welcome
  // ============================================
  const [showProgressSummary, setShowProgressSummary] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);

  // ============================================
  // State - Utility Modals
  // ============================================
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showStrategicDashboard, setShowStrategicDashboard] = useState(false);

  // ============================================
  // State - Template
  // ============================================
  const [templateTodo, setTemplateTodo] = useState<Todo | null>(null);

  // ============================================
  // State - Confirm Dialog
  // ============================================
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(defaultConfirmDialog);

  // ============================================
  // State - Completion Summary
  // ============================================
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [completedTaskForSummary, setCompletedTaskForSummary] = useState<Todo | null>(null);

  // ============================================
  // State - Duplicate Detection
  // ============================================
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [pendingTask, setPendingTask] = useState<PendingTaskData | null>(null);

  // ============================================
  // State - Email Modal
  // ============================================
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTargetTodos, setEmailTargetTodos] = useState<Todo[]>([]);

  // ============================================
  // State - Archive
  // ============================================
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [selectedArchivedTodo, setSelectedArchivedTodo] = useState<Todo | null>(null);
  const [archiveQuery, setArchiveQueryState] = useState('');
  const [archiveTick, setArchiveTick] = useState(0);

  // ============================================
  // State - Merge Modal
  // ============================================
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<Todo[]>([]);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // ============================================
  // State - Activity Log
  // ============================================
  const [activityLog, setActivityLogState] = useState<ActivityLogEntry[]>([]);

  // ============================================
  // Actions - Celebration
  // ============================================
  const triggerCelebration = useCallback((text: string) => {
    setCelebrationText(text);
    setShowCelebration(true);
    onModalOpen?.('celebration');
  }, [onModalOpen]);

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
    setCelebrationText('');
    onModalClose?.('celebration');
  }, [onModalClose]);

  const triggerEnhancedCelebration = useCallback((data: CelebrationData) => {
    setCelebrationData(data);
    setShowEnhancedCelebration(true);
    onModalOpen?.('enhancedCelebration');
  }, [onModalOpen]);

  const dismissEnhancedCelebration = useCallback(() => {
    setShowEnhancedCelebration(false);
    setCelebrationData(null);
    onModalClose?.('enhancedCelebration');
  }, [onModalClose]);

  // ============================================
  // Actions - Progress & Welcome
  // ============================================
  const openProgressSummary = useCallback(() => {
    setShowProgressSummary(true);
    onModalOpen?.('progressSummary');
  }, [onModalOpen]);

  const closeProgressSummary = useCallback(() => {
    setShowProgressSummary(false);
    onModalClose?.('progressSummary');
  }, [onModalClose]);

  const openWelcomeBack = useCallback(() => {
    setShowWelcomeBack(true);
    onModalOpen?.('welcomeBack');
  }, [onModalOpen]);

  const closeWelcomeBack = useCallback(() => {
    setShowWelcomeBack(false);
    onModalClose?.('welcomeBack');
  }, [onModalClose]);

  const openWeeklyChart = useCallback(() => {
    setShowWeeklyChart(true);
    onModalOpen?.('weeklyChart');
  }, [onModalOpen]);

  const closeWeeklyChart = useCallback(() => {
    setShowWeeklyChart(false);
    onModalClose?.('weeklyChart');
  }, [onModalClose]);

  // ============================================
  // Actions - Utility Modals
  // ============================================
  const openShortcuts = useCallback(() => {
    setShowShortcuts(true);
    onModalOpen?.('shortcuts');
  }, [onModalOpen]);

  const closeShortcuts = useCallback(() => {
    setShowShortcuts(false);
    onModalClose?.('shortcuts');
  }, [onModalClose]);

  const openActivityFeed = useCallback(() => {
    setShowActivityFeed(true);
    onModalOpen?.('activityFeed');
  }, [onModalOpen]);

  const closeActivityFeed = useCallback(() => {
    setShowActivityFeed(false);
    onModalClose?.('activityFeed');
  }, [onModalClose]);

  const openStrategicDashboard = useCallback(() => {
    setShowStrategicDashboard(true);
    onModalOpen?.('strategicDashboard');
  }, [onModalOpen]);

  const closeStrategicDashboard = useCallback(() => {
    setShowStrategicDashboard(false);
    onModalClose?.('strategicDashboard');
  }, [onModalClose]);

  // ============================================
  // Actions - Template
  // ============================================
  const openTemplateModal = useCallback((todo: Todo) => {
    setTemplateTodo(todo);
    onModalOpen?.('template');
  }, [onModalOpen]);

  const closeTemplateModal = useCallback(() => {
    setTemplateTodo(null);
    onModalClose?.('template');
  }, [onModalClose]);

  // ============================================
  // Actions - Confirm Dialog
  // ============================================
  const openConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
    onModalOpen?.('confirmDialog');
  }, [onModalOpen]);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(defaultConfirmDialog);
    onModalClose?.('confirmDialog');
  }, [onModalClose]);

  // ============================================
  // Actions - Completion Summary
  // ============================================
  const openCompletionSummary = useCallback((todo: Todo) => {
    setCompletedTaskForSummary(todo);
    setShowCompletionSummary(true);
    onModalOpen?.('completionSummary');
  }, [onModalOpen]);

  const closeCompletionSummary = useCallback(() => {
    setShowCompletionSummary(false);
    setCompletedTaskForSummary(null);
    onModalClose?.('completionSummary');
  }, [onModalClose]);

  // ============================================
  // Actions - Duplicate Detection
  // ============================================
  const openDuplicateModal = useCallback((task: PendingTaskData, matches: DuplicateMatch[]) => {
    setPendingTask(task);
    setDuplicateMatches(matches);
    setShowDuplicateModal(true);
    onModalOpen?.('duplicateDetection');
  }, [onModalOpen]);

  const closeDuplicateModal = useCallback(() => {
    setShowDuplicateModal(false);
    onModalClose?.('duplicateDetection');
  }, [onModalClose]);

  const clearDuplicateState = useCallback(() => {
    setShowDuplicateModal(false);
    setDuplicateMatches([]);
    setPendingTask(null);
    onModalClose?.('duplicateDetection');
  }, [onModalClose]);

  // ============================================
  // Actions - Email
  // ============================================
  const openEmailModal = useCallback((todos: Todo[]) => {
    setEmailTargetTodos(todos);
    setShowEmailModal(true);
    onModalOpen?.('email');
  }, [onModalOpen]);

  const closeEmailModal = useCallback(() => {
    setShowEmailModal(false);
    setEmailTargetTodos([]);
    onModalClose?.('email');
  }, [onModalClose]);

  // ============================================
  // Actions - Archive
  // ============================================
  const openArchiveView = useCallback(() => {
    setShowArchiveView(true);
    onModalOpen?.('archive');
  }, [onModalOpen]);

  const closeArchiveView = useCallback(() => {
    setShowArchiveView(false);
    setSelectedArchivedTodo(null);
    setArchiveQueryState('');
    onModalClose?.('archive');
  }, [onModalClose]);

  const selectArchivedTodo = useCallback((todo: Todo | null) => {
    setSelectedArchivedTodo(todo);
  }, []);

  const setArchiveQuery = useCallback((query: string) => {
    setArchiveQueryState(query);
  }, []);

  const incrementArchiveTick = useCallback(() => {
    setArchiveTick((prev) => prev + 1);
  }, []);

  // ============================================
  // Actions - Merge
  // ============================================
  const openMergeModal = useCallback((targets: Todo[]) => {
    setMergeTargets(targets);
    setSelectedPrimaryId(targets[0]?.id || null);
    setShowMergeModal(true);
    onModalOpen?.('merge');
  }, [onModalOpen]);

  const closeMergeModal = useCallback(() => {
    setShowMergeModal(false);
    setMergeTargets([]);
    setSelectedPrimaryId(null);
    setIsMerging(false);
    onModalClose?.('merge');
  }, [onModalClose]);

  const setMergePrimaryId = useCallback((id: string | null) => {
    setSelectedPrimaryId(id);
  }, []);

  const setMergingState = useCallback((merging: boolean) => {
    setIsMerging(merging);
  }, []);

  // ============================================
  // Actions - Activity Log
  // ============================================
  const setActivityLog = useCallback((log: ActivityLogEntry[]) => {
    setActivityLogState(log);
  }, []);

  // ============================================
  // Utility Actions
  // ============================================
  const closeAllModals = useCallback(() => {
    // Close celebration modals
    setShowCelebration(false);
    setCelebrationText('');
    setShowEnhancedCelebration(false);
    setCelebrationData(null);

    // Close progress & welcome modals
    setShowProgressSummary(false);
    setShowWelcomeBack(false);
    setShowWeeklyChart(false);

    // Close utility modals
    setShowShortcuts(false);
    setShowActivityFeed(false);
    setShowStrategicDashboard(false);

    // Close template modal
    setTemplateTodo(null);

    // Close confirm dialog
    setConfirmDialog(defaultConfirmDialog);

    // Close completion summary
    setShowCompletionSummary(false);
    setCompletedTaskForSummary(null);

    // Close duplicate detection
    setShowDuplicateModal(false);
    setDuplicateMatches([]);
    setPendingTask(null);

    // Close email modal
    setShowEmailModal(false);
    setEmailTargetTodos([]);

    // Close archive view
    setShowArchiveView(false);
    setSelectedArchivedTodo(null);
    setArchiveQueryState('');

    // Close merge modal
    setShowMergeModal(false);
    setMergeTargets([]);
    setSelectedPrimaryId(null);
    setIsMerging(false);

    onModalClose?.('all');
  }, [onModalClose]);

  return {
    // Celebration state
    showCelebration,
    celebrationText,
    showEnhancedCelebration,
    celebrationData,

    // Progress & welcome state
    showProgressSummary,
    showWelcomeBack,
    showWeeklyChart,

    // Utility modals state
    showShortcuts,
    showActivityFeed,
    showStrategicDashboard,

    // Template state
    templateTodo,

    // Confirm dialog state
    confirmDialog,

    // Completion summary state
    showCompletionSummary,
    completedTaskForSummary,

    // Duplicate detection state
    showDuplicateModal,
    duplicateMatches,
    pendingTask,

    // Email modal state
    showEmailModal,
    emailTargetTodos,

    // Archive state
    showArchiveView,
    selectedArchivedTodo,
    archiveQuery,
    archiveTick,

    // Merge modal state
    showMergeModal,
    mergeTargets,
    selectedPrimaryId,
    isMerging,

    // Activity log state
    activityLog,

    // Actions - Celebration
    triggerCelebration,
    dismissCelebration,
    triggerEnhancedCelebration,
    dismissEnhancedCelebration,

    // Actions - Progress & welcome
    openProgressSummary,
    closeProgressSummary,
    openWelcomeBack,
    closeWelcomeBack,
    openWeeklyChart,
    closeWeeklyChart,

    // Actions - Utility modals
    openShortcuts,
    closeShortcuts,
    openActivityFeed,
    closeActivityFeed,
    openStrategicDashboard,
    closeStrategicDashboard,

    // Actions - Template
    openTemplateModal,
    closeTemplateModal,

    // Actions - Confirm dialog
    openConfirmDialog,
    closeConfirmDialog,

    // Actions - Completion summary
    openCompletionSummary,
    closeCompletionSummary,

    // Actions - Duplicate detection
    openDuplicateModal,
    closeDuplicateModal,
    clearDuplicateState,

    // Actions - Email
    openEmailModal,
    closeEmailModal,

    // Actions - Archive
    openArchiveView,
    closeArchiveView,
    selectArchivedTodo,
    setArchiveQuery,
    incrementArchiveTick,

    // Actions - Merge
    openMergeModal,
    closeMergeModal,
    setMergePrimaryId,
    setMergingState,

    // Actions - Activity log
    setActivityLog,

    // Utility actions
    closeAllModals,
  };
}
