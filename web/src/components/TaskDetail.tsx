'use client';

import { useState } from 'react';
import { Task, TaskStatus, TaskPriority, UpdateTaskInput } from '@/types/task';
import { addNote, deleteNote, getTask } from '@/lib/api';

interface TaskDetailProps {
  task: Task;
  onUpdate: (id: string, updates: UpdateTaskInput) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onNoteAdded: (task: Task) => void;
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toISOString().slice(0, 16);
}

function formatDisplayDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const priorityLabels: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const priorityColors: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

export default function TaskDetail({ task, onUpdate, onDelete, onClose, onNoteAdded }: TaskDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('Derrick');
  const [addingNote, setAddingNote] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    category: task.category || '',
    assignee: task.assignee || '',
    dueDate: formatDateTime(task.dueDate),
    reminderTime: formatDateTime(task.reminderTime),
  });

  const handleSave = () => {
    onUpdate(task.id, {
      title: editData.title,
      description: editData.description || undefined,
      status: editData.status,
      priority: editData.priority,
      category: editData.category || undefined,
      assignee: editData.assignee || undefined,
      dueDate: editData.dueDate || null,
      reminderTime: editData.reminderTime || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      title: task.title,
      description: task.description || '',
      status: task.status as TaskStatus,
      priority: task.priority as TaskPriority,
      category: task.category || '',
      assignee: task.assignee || '',
      dueDate: formatDateTime(task.dueDate),
      reminderTime: formatDateTime(task.reminderTime),
    });
    setIsEditing(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await addNote(task.id, newNote.trim(), noteAuthor);
      const updatedTask = await getTask(task.id);
      onNoteAdded(updatedTask);
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(task.id, noteId);
      const updatedTask = await getTask(task.id);
      onNoteAdded(updatedTask);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="w-full text-xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 ml-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          {isEditing ? (
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="text-gray-600">{task.description || 'No description'}</p>
          )}
        </div>

        {/* Priority & Status Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            {isEditing ? (
              <select
                value={editData.priority}
                onChange={(e) => setEditData({ ...editData, priority: e.target.value as TaskPriority })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                priorityColors[task.priority as TaskPriority] || priorityColors.medium
              }`}>
                {priorityLabels[task.priority as TaskPriority] || 'Medium'}
              </span>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            {isEditing ? (
              <select
                value={editData.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value as TaskStatus })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                task.status === 'done' ? 'bg-green-100 text-green-700' :
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
              </span>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          {isEditing ? (
            <input
              type="text"
              value={editData.category}
              onChange={(e) => setEditData({ ...editData, category: e.target.value })}
              placeholder="e.g., Marketing, Sales, Support..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="text-gray-600">
              {task.category ? (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-sm">{task.category}</span>
              ) : (
                'No category'
              )}
            </p>
          )}
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
          {isEditing ? (
            <select
              value={editData.assignee}
              onChange={(e) => setEditData({ ...editData, assignee: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Unassigned</option>
              <option value="Derrick">Derrick</option>
              <option value="Sefra">Sefra</option>
            </select>
          ) : (
            <p className="text-gray-600">{task.assignee || 'Unassigned'}</p>
          )}
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          {isEditing ? (
            <input
              type="datetime-local"
              value={editData.dueDate}
              onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="text-gray-600">{formatDisplayDate(task.dueDate)}</p>
          )}
        </div>

        {/* Reminder Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Time</label>
          {isEditing ? (
            <input
              type="datetime-local"
              value={editData.reminderTime}
              onChange={(e) => setEditData({ ...editData, reminderTime: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="text-gray-600">
              {formatDisplayDate(task.reminderTime)}
              {task.reminderSent && task.reminderTime && ' (sent)'}
            </p>
          )}
        </div>

        {/* Notes Section */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes ({task.notes?.length || 0})</h3>

          {/* Add Note */}
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <select
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="Derrick">Derrick</option>
                <option value="Sefra">Sefra</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingNote ? '...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {task.notes && task.notes.length > 0 ? (
              task.notes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-3 text-sm group relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-900">{note.author}</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-gray-600 mt-1">{note.content}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No notes yet</p>
            )}
          </div>
        </div>

        {/* Email Metadata */}
        {task.sourceEmailId && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Email Source</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">From:</span>{' '}
                <span className="text-gray-900">{task.sourceEmailFrom || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Received:</span>{' '}
                <span className="text-gray-900">{formatDisplayDate(task.sourceEmailReceived)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="border-t border-gray-200 pt-4 mt-4 text-sm text-gray-500">
          <div>Created: {formatDisplayDate(task.createdAt)}</div>
          <div>Updated: {formatDisplayDate(task.updatedAt)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                }
              }}
              className="px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
