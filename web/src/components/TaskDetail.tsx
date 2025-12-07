'use client';

import { useState } from 'react';
import { Task, TaskStatus, TaskPriority, UpdateTaskInput } from '@/types/task';
import { addNote, deleteNote, getTask } from '@/lib/api';
import ConfirmModal from './ConfirmModal';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-h-[calc(100vh-200px)] overflow-y-auto animate-slideIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="w-full text-xl font-bold text-gray-900 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
            />
          ) : (
            <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-4 p-2 rounded-lg transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-5">
        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          {isEditing ? (
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
              placeholder="Add a description..."
            />
          ) : (
            <p className="text-gray-600 bg-gray-50 rounded-xl px-4 py-3">{task.description || 'No description'}</p>
          )}
        </div>

        {/* Priority & Status Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
            {isEditing ? (
              <select
                value={editData.priority}
                onChange={(e) => setEditData({ ...editData, priority: e.target.value as TaskPriority })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 cursor-pointer"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                priorityColors[task.priority as TaskPriority] || priorityColors.medium
              }`}>
                {priorityLabels[task.priority as TaskPriority] || 'Medium'}
              </span>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            {isEditing ? (
              <select
                value={editData.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value as TaskStatus })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 cursor-pointer"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                task.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                task.status === 'in_progress' ? 'bg-[#e6f0f9] text-[#003B73]' :
                'bg-slate-100 text-slate-700'
              }`}>
                {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
              </span>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          {isEditing ? (
            <input
              type="text"
              value={editData.category}
              onChange={(e) => setEditData({ ...editData, category: e.target.value })}
              placeholder="e.g., Marketing, Sales, Support..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
            />
          ) : (
            <div>
              {task.category ? (
                <span className="inline-flex items-center bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">{task.category}</span>
              ) : (
                <span className="text-gray-400 italic">No category</span>
              )}
            </div>
          )}
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Assignee</label>
          {isEditing ? (
            <select
              value={editData.assignee}
              onChange={(e) => setEditData({ ...editData, assignee: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 cursor-pointer"
            >
              <option value="">Unassigned</option>
              <option value="Derrick">Derrick</option>
              <option value="Sefra">Sefra</option>
            </select>
          ) : (
            <div>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071CE] to-[#003B73] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {task.assignee.charAt(0)}
                  </div>
                  <span className="text-gray-700 font-medium">{task.assignee}</span>
                </div>
              ) : (
                <span className="text-gray-400 italic">Unassigned</span>
              )}
            </div>
          )}
        </div>

        {/* Due Date & Reminder Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
            {isEditing ? (
              <input
                type="datetime-local"
                value={editData.dueDate}
                onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 cursor-pointer"
              />
            ) : (
              <p className="text-gray-600">{formatDisplayDate(task.dueDate)}</p>
            )}
          </div>

          {/* Reminder Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reminder</label>
            {isEditing ? (
              <input
                type="datetime-local"
                value={editData.reminderTime}
                onChange={(e) => setEditData({ ...editData, reminderTime: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-gray-50 cursor-pointer"
              />
            ) : (
              <p className="text-gray-600">
                {formatDisplayDate(task.reminderTime)}
                {task.reminderSent && task.reminderTime && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">Sent</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="border-t border-gray-100 pt-5 mt-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Notes
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{task.notes?.length || 0}</span>
          </h3>

          {/* Add Note */}
          <div className="mb-4 bg-gray-50 rounded-xl p-3">
            <div className="flex gap-2 items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071CE] to-[#003B73] flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                {noteAuthor.charAt(0)}
              </div>
              <select
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer"
              >
                <option value="Derrick">Derrick</option>
                <option value="Sefra">Sefra</option>
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071CE] focus:border-transparent bg-white"
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
                className="px-4 py-2.5 bg-[#003B73] text-white text-sm rounded-xl hover:bg-[#002d59] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
              >
                {addingNote ? '...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {task.notes && task.notes.length > 0 ? (
              task.notes.map((note) => (
                <div key={note.id} className="bg-white border border-gray-100 rounded-xl p-3 text-sm group relative hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0071CE] to-[#003B73] flex items-center justify-center text-white text-xs font-bold">
                        {note.author.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{note.author}</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-red-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-gray-600 mt-2 pl-8">{note.content}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-4 italic">No notes yet</p>
            )}
          </div>
        </div>

        {/* Email Metadata */}
        {task.sourceEmailId && (
          <div className="border-t border-gray-100 pt-5 mt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#0071CE]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Source
            </h3>
            <div className="bg-[#e6f0f9] rounded-xl p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#003B73] font-medium">From:</span>
                <span className="text-gray-900">{task.sourceEmailFrom || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#003B73] font-medium">Received:</span>
                <span className="text-gray-900">{formatDisplayDate(task.sourceEmailReceived)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="border-t border-gray-100 pt-4 mt-5 flex gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Created: {formatDisplayDate(task.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Updated: {formatDisplayDate(task.updatedAt)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              className="flex-1 bg-[#003B73] text-white px-5 py-2.5 rounded-xl hover:bg-[#002d59] transition-all font-semibold shadow-sm hover:shadow flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </button>
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 text-gray-600 hover:text-gray-800 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-medium"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 bg-[#003B73] text-white px-5 py-2.5 rounded-xl hover:bg-[#002d59] transition-all font-semibold shadow-sm hover:shadow flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-5 py-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-xl transition-all font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          setShowDeleteModal(false);
          onDelete(task.id);
        }}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
