/**
 * useTodoModals Hook Tests
 *
 * Tests for the modal state management hook.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodoModals } from '@/hooks/useTodoModals';
import { Todo, CelebrationData, ActivityLogEntry } from '@/types/todo';
import { DuplicateMatch } from '@/lib/duplicateDetection';

// Helper to create a mock todo
const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: 'test-todo-1',
  text: 'Test task',
  completed: false,
  status: 'todo',
  priority: 'medium',
  created_at: new Date().toISOString(),
  created_by: 'TestUser',
  ...overrides,
});

// Helper to create mock celebration data
const createMockCelebrationData = (todo: Todo): CelebrationData => ({
  completedTask: todo,
  nextTasks: [],
  streakCount: 5,
  encouragementMessage: 'Great job!',
});

// Helper to create mock duplicate match
const createMockDuplicateMatch = (todo: Todo): DuplicateMatch => ({
  todo,
  score: 0.85,
  matchReasons: ['Similar text'],
});

describe('useTodoModals', () => {
  describe('Initial State', () => {
    it('should initialize with all modals closed', () => {
      const { result } = renderHook(() => useTodoModals());

      // All boolean show states should be false
      expect(result.current.showCelebration).toBe(false);
      expect(result.current.showEnhancedCelebration).toBe(false);
      expect(result.current.showProgressSummary).toBe(false);
      expect(result.current.showWelcomeBack).toBe(false);
      expect(result.current.showWeeklyChart).toBe(false);
      expect(result.current.showShortcuts).toBe(false);
      expect(result.current.showActivityFeed).toBe(false);
      expect(result.current.showStrategicDashboard).toBe(false);
      expect(result.current.showCompletionSummary).toBe(false);
      expect(result.current.showDuplicateModal).toBe(false);
      expect(result.current.showEmailModal).toBe(false);
      expect(result.current.showArchiveView).toBe(false);
      expect(result.current.showMergeModal).toBe(false);

      // Data states should be null/empty
      expect(result.current.celebrationText).toBe('');
      expect(result.current.celebrationData).toBeNull();
      expect(result.current.templateTodo).toBeNull();
      expect(result.current.completedTaskForSummary).toBeNull();
      expect(result.current.duplicateMatches).toEqual([]);
      expect(result.current.pendingTask).toBeNull();
      expect(result.current.emailTargetTodos).toEqual([]);
      expect(result.current.selectedArchivedTodo).toBeNull();
      expect(result.current.archiveQuery).toBe('');
      expect(result.current.mergeTargets).toEqual([]);
      expect(result.current.selectedPrimaryId).toBeNull();
      expect(result.current.isMerging).toBe(false);
      expect(result.current.activityLog).toEqual([]);

      // Confirm dialog should be closed
      expect(result.current.confirmDialog.isOpen).toBe(false);
    });
  });

  describe('Celebration Actions', () => {
    it('should open and close simple celebration', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.triggerCelebration('Task completed!');
      });

      expect(result.current.showCelebration).toBe(true);
      expect(result.current.celebrationText).toBe('Task completed!');

      act(() => {
        result.current.dismissCelebration();
      });

      expect(result.current.showCelebration).toBe(false);
      expect(result.current.celebrationText).toBe('');
    });

    it('should open and close enhanced celebration', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const mockCelebrationData = createMockCelebrationData(mockTodo);

      act(() => {
        result.current.triggerEnhancedCelebration(mockCelebrationData);
      });

      expect(result.current.showEnhancedCelebration).toBe(true);
      expect(result.current.celebrationData).toEqual(mockCelebrationData);

      act(() => {
        result.current.dismissEnhancedCelebration();
      });

      expect(result.current.showEnhancedCelebration).toBe(false);
      expect(result.current.celebrationData).toBeNull();
    });
  });

  describe('Progress & Welcome Actions', () => {
    it('should open and close progress summary', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openProgressSummary();
      });
      expect(result.current.showProgressSummary).toBe(true);

      act(() => {
        result.current.closeProgressSummary();
      });
      expect(result.current.showProgressSummary).toBe(false);
    });

    it('should open and close welcome back', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openWelcomeBack();
      });
      expect(result.current.showWelcomeBack).toBe(true);

      act(() => {
        result.current.closeWelcomeBack();
      });
      expect(result.current.showWelcomeBack).toBe(false);
    });

    it('should open and close weekly chart', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openWeeklyChart();
      });
      expect(result.current.showWeeklyChart).toBe(true);

      act(() => {
        result.current.closeWeeklyChart();
      });
      expect(result.current.showWeeklyChart).toBe(false);
    });
  });

  describe('Utility Modal Actions', () => {
    it('should open and close shortcuts modal', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openShortcuts();
      });
      expect(result.current.showShortcuts).toBe(true);

      act(() => {
        result.current.closeShortcuts();
      });
      expect(result.current.showShortcuts).toBe(false);
    });

    it('should open and close activity feed', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openActivityFeed();
      });
      expect(result.current.showActivityFeed).toBe(true);

      act(() => {
        result.current.closeActivityFeed();
      });
      expect(result.current.showActivityFeed).toBe(false);
    });

    it('should open and close strategic dashboard', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openStrategicDashboard();
      });
      expect(result.current.showStrategicDashboard).toBe(true);

      act(() => {
        result.current.closeStrategicDashboard();
      });
      expect(result.current.showStrategicDashboard).toBe(false);
    });
  });

  describe('Template Actions', () => {
    it('should open and close template modal', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();

      act(() => {
        result.current.openTemplateModal(mockTodo);
      });
      expect(result.current.templateTodo).toEqual(mockTodo);

      act(() => {
        result.current.closeTemplateModal();
      });
      expect(result.current.templateTodo).toBeNull();
    });
  });

  describe('Confirm Dialog Actions', () => {
    it('should open and close confirm dialog', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockOnConfirm = vi.fn();

      act(() => {
        result.current.openConfirmDialog('Delete Task', 'Are you sure?', mockOnConfirm);
      });

      expect(result.current.confirmDialog.isOpen).toBe(true);
      expect(result.current.confirmDialog.title).toBe('Delete Task');
      expect(result.current.confirmDialog.message).toBe('Are you sure?');
      expect(result.current.confirmDialog.onConfirm).toBe(mockOnConfirm);

      act(() => {
        result.current.closeConfirmDialog();
      });

      expect(result.current.confirmDialog.isOpen).toBe(false);
      expect(result.current.confirmDialog.title).toBe('');
      expect(result.current.confirmDialog.message).toBe('');
    });
  });

  describe('Completion Summary Actions', () => {
    it('should open and close completion summary', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();

      act(() => {
        result.current.openCompletionSummary(mockTodo);
      });

      expect(result.current.showCompletionSummary).toBe(true);
      expect(result.current.completedTaskForSummary).toEqual(mockTodo);

      act(() => {
        result.current.closeCompletionSummary();
      });

      expect(result.current.showCompletionSummary).toBe(false);
      expect(result.current.completedTaskForSummary).toBeNull();
    });
  });

  describe('Duplicate Detection Actions', () => {
    it('should open duplicate modal with pending task and matches', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const mockDuplicateMatch = createMockDuplicateMatch(mockTodo);
      const pendingTask = {
        text: 'New task',
        priority: 'medium' as const,
      };
      const matches = [mockDuplicateMatch];

      act(() => {
        result.current.openDuplicateModal(pendingTask, matches);
      });

      expect(result.current.showDuplicateModal).toBe(true);
      expect(result.current.pendingTask).toEqual(pendingTask);
      expect(result.current.duplicateMatches).toEqual(matches);
    });

    it('should close duplicate modal', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const mockDuplicateMatch = createMockDuplicateMatch(mockTodo);
      const pendingTask = { text: 'New task', priority: 'medium' as const };

      act(() => {
        result.current.openDuplicateModal(pendingTask, [mockDuplicateMatch]);
      });

      act(() => {
        result.current.closeDuplicateModal();
      });

      expect(result.current.showDuplicateModal).toBe(false);
      // Note: closeDuplicateModal only closes the modal, not clears state
    });

    it('should clear all duplicate state', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const mockDuplicateMatch = createMockDuplicateMatch(mockTodo);
      const pendingTask = { text: 'New task', priority: 'medium' as const };

      act(() => {
        result.current.openDuplicateModal(pendingTask, [mockDuplicateMatch]);
      });

      act(() => {
        result.current.clearDuplicateState();
      });

      expect(result.current.showDuplicateModal).toBe(false);
      expect(result.current.pendingTask).toBeNull();
      expect(result.current.duplicateMatches).toEqual([]);
    });
  });

  describe('Email Modal Actions', () => {
    it('should open and close email modal', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const todos = [mockTodo];

      act(() => {
        result.current.openEmailModal(todos);
      });

      expect(result.current.showEmailModal).toBe(true);
      expect(result.current.emailTargetTodos).toEqual(todos);

      act(() => {
        result.current.closeEmailModal();
      });

      expect(result.current.showEmailModal).toBe(false);
      expect(result.current.emailTargetTodos).toEqual([]);
    });
  });

  describe('Archive Actions', () => {
    it('should open and close archive view', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.openArchiveView();
      });
      expect(result.current.showArchiveView).toBe(true);

      act(() => {
        result.current.closeArchiveView();
      });
      expect(result.current.showArchiveView).toBe(false);
      expect(result.current.selectedArchivedTodo).toBeNull();
      expect(result.current.archiveQuery).toBe('');
    });

    it('should select archived todo', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();

      act(() => {
        result.current.selectArchivedTodo(mockTodo);
      });
      expect(result.current.selectedArchivedTodo).toEqual(mockTodo);

      act(() => {
        result.current.selectArchivedTodo(null);
      });
      expect(result.current.selectedArchivedTodo).toBeNull();
    });

    it('should set archive query', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.setArchiveQuery('search term');
      });
      expect(result.current.archiveQuery).toBe('search term');
    });

    it('should increment archive tick', () => {
      const { result } = renderHook(() => useTodoModals());
      const initialTick = result.current.archiveTick;

      act(() => {
        result.current.incrementArchiveTick();
      });
      expect(result.current.archiveTick).toBe(initialTick + 1);
    });
  });

  describe('Merge Modal Actions', () => {
    it('should open merge modal with targets', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const targets = [mockTodo, createMockTodo({ id: 'test-todo-2' })];

      act(() => {
        result.current.openMergeModal(targets);
      });

      expect(result.current.showMergeModal).toBe(true);
      expect(result.current.mergeTargets).toEqual(targets);
      expect(result.current.selectedPrimaryId).toBe(mockTodo.id);
    });

    it('should close merge modal and reset state', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();
      const targets = [mockTodo];

      act(() => {
        result.current.openMergeModal(targets);
        result.current.setMergingState(true);
      });

      act(() => {
        result.current.closeMergeModal();
      });

      expect(result.current.showMergeModal).toBe(false);
      expect(result.current.mergeTargets).toEqual([]);
      expect(result.current.selectedPrimaryId).toBeNull();
      expect(result.current.isMerging).toBe(false);
    });

    it('should set merge primary id', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.setMergePrimaryId('custom-id');
      });
      expect(result.current.selectedPrimaryId).toBe('custom-id');
    });

    it('should set merging state', () => {
      const { result } = renderHook(() => useTodoModals());

      act(() => {
        result.current.setMergingState(true);
      });
      expect(result.current.isMerging).toBe(true);
    });
  });

  describe('Activity Log Actions', () => {
    it('should set activity log', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockLog: ActivityLogEntry[] = [{
        id: 'log-1',
        action: 'task_created',
        user_name: 'TestUser',
        created_at: new Date().toISOString(),
        details: {},
      }];

      act(() => {
        result.current.setActivityLog(mockLog);
      });
      expect(result.current.activityLog).toEqual(mockLog);
    });
  });

  describe('Close All Modals', () => {
    it('should close all open modals', () => {
      const { result } = renderHook(() => useTodoModals());
      const mockTodo = createMockTodo();

      // Open multiple modals
      act(() => {
        result.current.triggerCelebration('Test');
        result.current.openShortcuts();
        result.current.openActivityFeed();
        result.current.openArchiveView();
        result.current.openEmailModal([mockTodo]);
      });

      // Verify they're open
      expect(result.current.showCelebration).toBe(true);
      expect(result.current.showShortcuts).toBe(true);
      expect(result.current.showActivityFeed).toBe(true);
      expect(result.current.showArchiveView).toBe(true);
      expect(result.current.showEmailModal).toBe(true);

      // Close all
      act(() => {
        result.current.closeAllModals();
      });

      // Verify all closed
      expect(result.current.showCelebration).toBe(false);
      expect(result.current.showShortcuts).toBe(false);
      expect(result.current.showActivityFeed).toBe(false);
      expect(result.current.showArchiveView).toBe(false);
      expect(result.current.showEmailModal).toBe(false);
      expect(result.current.emailTargetTodos).toEqual([]);
    });
  });

  describe('Callbacks', () => {
    it('should call onModalOpen callback when modal opens', () => {
      const onModalOpen = vi.fn();
      const { result } = renderHook(() => useTodoModals({ onModalOpen }));

      act(() => {
        result.current.openShortcuts();
      });

      expect(onModalOpen).toHaveBeenCalledWith('shortcuts');
    });

    it('should call onModalClose callback when modal closes', () => {
      const onModalClose = vi.fn();
      const { result } = renderHook(() => useTodoModals({ onModalClose }));

      act(() => {
        result.current.openShortcuts();
      });

      act(() => {
        result.current.closeShortcuts();
      });

      expect(onModalClose).toHaveBeenCalledWith('shortcuts');
    });

    it('should call onModalClose with "all" when closeAllModals is called', () => {
      const onModalClose = vi.fn();
      const { result } = renderHook(() => useTodoModals({ onModalClose }));

      act(() => {
        result.current.closeAllModals();
      });

      expect(onModalClose).toHaveBeenCalledWith('all');
    });
  });
});
