import { useState, useEffect, useCallback } from 'react';
import type { Todo, Subtask } from '@/types/todo';
import { PRIORITY_CONFIG as PriorityConfig } from '@/types/todo';

interface UseTaskDetailStateProps {
  todo: Todo;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
}

export function useTaskDetailState({
  todo,
  onUpdateText,
  onUpdateNotes,
  onUpdateSubtasks,
  onSetDueDate,
}: UseTaskDetailStateProps) {
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(todo.text);
  const [notes, setNotes] = useState(todo.notes || '');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showContentImporter, setShowContentImporter] = useState(false);
  const [showAttachmentUpload, setShowAttachmentUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  // Sync text when todo prop changes (real-time updates) and not actively editing
  useEffect(() => {
    if (!editingText) {
      setText(todo.text);
    }
  }, [todo.text, editingText]);

  // Sync notes when todo prop changes (real-time updates) and not actively editing
  useEffect(() => {
    if (!editingNotes) {
      setNotes(todo.notes || '');
    }
  }, [todo.notes, editingNotes]);

  // Derived values
  const subtasks = todo.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0
    ? Math.round((completedSubtasks / subtasks.length) * 100)
    : 0;
  const priority = todo.priority || 'medium';
  const priorityConfig = PriorityConfig[priority];

  // Text editing
  const handleSaveText = useCallback(() => {
    const trimmed = text.trim();
    if (onUpdateText && trimmed && trimmed !== todo.text) {
      onUpdateText(todo.id, trimmed);
    }
    setEditingText(false);
  }, [text, todo.text, todo.id, onUpdateText]);

  const handleCancelEdit = useCallback(() => {
    setText(todo.text);
    setEditingText(false);
  }, [todo.text]);

  // Notes
  const handleSaveNotes = useCallback(() => {
    if (onUpdateNotes && notes !== (todo.notes || '')) {
      onUpdateNotes(todo.id, notes);
    }
  }, [notes, todo.notes, todo.id, onUpdateNotes]);

  // Subtask operations
  const toggleSubtask = useCallback((subtaskId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    onUpdateSubtasks(todo.id, updated);
  }, [subtasks, todo.id, onUpdateSubtasks]);

  const deleteSubtask = useCallback((subtaskId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.filter(s => s.id !== subtaskId);
    onUpdateSubtasks(todo.id, updated);
  }, [subtasks, todo.id, onUpdateSubtasks]);

  const updateSubtaskText = useCallback((subtaskId: string, newText: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, text: newText } : s
    );
    onUpdateSubtasks(todo.id, updated);
  }, [subtasks, todo.id, onUpdateSubtasks]);

  const addManualSubtask = useCallback(() => {
    if (!onUpdateSubtasks || !newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: `${todo.id}-sub-${Date.now()}`,
      text: newSubtaskText.trim(),
      completed: false,
      priority: 'medium',
    };
    onUpdateSubtasks(todo.id, [...subtasks, newSubtask]);
    setNewSubtaskText('');
  }, [newSubtaskText, subtasks, todo.id, onUpdateSubtasks]);

  const handleAddImportedSubtasks = useCallback((importedSubtasks: Subtask[]) => {
    if (!onUpdateSubtasks) return;
    onUpdateSubtasks(todo.id, [...subtasks, ...importedSubtasks]);
    setShowContentImporter(false);
  }, [subtasks, todo.id, onUpdateSubtasks]);

  // Snooze
  const handleSnooze = useCallback((days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    onSetDueDate(todo.id, date.toISOString().split('T')[0]);
    setShowSnoozeMenu(false);
  }, [todo.id, onSetDueDate]);

  return {
    // Text state
    editingText,
    setEditingText,
    text,
    setText,
    handleSaveText,
    handleCancelEdit,

    // Notes state
    notes,
    setNotes,
    editingNotes,
    setEditingNotes,
    handleSaveNotes,

    // Subtask state
    subtasks,
    completedSubtasks,
    subtaskProgress,
    newSubtaskText,
    setNewSubtaskText,
    toggleSubtask,
    deleteSubtask,
    updateSubtaskText,
    addManualSubtask,
    handleAddImportedSubtasks,

    // Snooze
    showSnoozeMenu,
    setShowSnoozeMenu,
    handleSnooze,

    // Modal sub-views
    showContentImporter,
    setShowContentImporter,
    showAttachmentUpload,
    setShowAttachmentUpload,
    showDeleteConfirm,
    setShowDeleteConfirm,

    // Derived
    priority,
    priorityConfig,
  };
}
