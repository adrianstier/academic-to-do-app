'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Upload, X, FolderKanban, ListChecks } from 'lucide-react';
import SmartParseModal from './SmartParseModal';
import ReminderPicker from './ReminderPicker';
import FileImporter from './FileImporter';
import TemplatePicker from './TemplatePicker';
import { TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { useTodoStore } from '@/store/todoStore';
import ProjectSelector from './ProjectSelector';
import { getUserPreferences, updateLastTaskDefaults } from '@/lib/userPreferences';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';
import { useToast } from './ui/Toast';
import { AIFeaturesMenu } from './ui/AIFeaturesMenu';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string, sourceFile?: File, reminderAt?: string, notes?: string, recurrence?: 'daily' | 'weekly' | 'monthly' | null, projectId?: string) => void;
  users: string[];
  darkMode?: boolean;
  currentUserId?: string;
  autoFocus?: boolean;
}

interface SmartParseResult {
  mainTask: {
    text: string;
    priority: TodoPriority;
    dueDate: string;
    assignedTo: string;
  };
  subtasks: Array<{
    text: string;
    priority: TodoPriority;
    estimatedMinutes?: number;
  }>;
  summary: string;
  wasComplex: boolean;
}

// SpeechRecognition types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export default function AddTodo({ onAdd, users, darkMode = true, currentUserId, autoFocus }: AddTodoProps) {
  const toast = useToast();

  // Core form state
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>(() => {
    if (typeof window !== 'undefined' && currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      return prefs.lastPriority || 'medium';
    }
    return 'medium';
  });
  const [dueDate, setDueDate] = useState('');
  const [reminderAt, setReminderAt] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const storeProjects = useTodoStore(state => state.projects);
  const [assignedTo, setAssignedTo] = useState(() => {
    if (typeof window !== 'undefined' && currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      if (prefs.lastAssignedTo && users.includes(prefs.lastAssignedTo)) {
        return prefs.lastAssignedTo;
      }
    }
    return '';
  });

  // File drag state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);

  // AI modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);

  // File importer state
  const [showFileImporter, setShowFileImporter] = useState(false);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSubtasks, setTemplateSubtasks] = useState<Subtask[]>([]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported] = useState(() => {
    if (typeof window !== 'undefined') {
      return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    }
    return false;
  });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Smart parse API call
  const smartParse = useCallback(async (inputText: string): Promise<SmartParseResult | null> => {
    try {
      const response = await fetchWithCsrf('/api/ai/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, users }),
      });

      if (!response.ok) {
        logger.error('Failed to smart parse', undefined, { component: 'AddTodo' });
        toast.error('AI parsing failed', {
          description: 'Could not parse your text. Try adding the task manually.',
        });
        return null;
      }

      const data = await response.json();
      if (data.success && data.result) {
        return data.result as SmartParseResult;
      }
      return null;
    } catch (error) {
      logger.error('Error in smart parse', error, { component: 'AddTodo' });
      toast.error('AI parsing failed', {
        description: 'Network error. Please try again.',
      });
      return null;
    }
  }, [users, toast]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            }
          }
          if (finalTranscript) {
            setText(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onerror = (event) => {
          logger.error('Speech recognition error', undefined, { component: 'AddTodo', error: event.error });
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.warning('Speech recognition is not supported in your browser', {
        description: 'Try using Chrome or Edge for voice input.',
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const subtasks = templateSubtasks.length > 0 ? templateSubtasks : undefined;
    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined, subtasks, undefined, undefined, reminderAt || undefined, undefined, null, selectedProjectId);
    if (currentUserId) {
      updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
    }
    resetForm();
  };

  const handleAiClick = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setShowModal(true);

    try {
      const result = await smartParse(text.trim());
      setParsedResult(result || {
        mainTask: { text: text.trim(), priority: 'medium', dueDate: '', assignedTo: '' },
        subtasks: [], summary: '', wasComplex: false,
      });
    } catch {
      setParsedResult({
        mainTask: { text: text.trim(), priority: 'medium', dueDate: '', assignedTo: '' },
        subtasks: [], summary: '', wasComplex: false,
      });
      toast.error('AI parsing encountered an error', {
        description: 'You can still edit and add the task manually.',
      });
    }

    setIsProcessing(false);
  };

  const handleModalConfirm = (
    taskText: string,
    taskPriority: TodoPriority,
    taskDueDate?: string,
    taskAssignedTo?: string,
    subtasks?: Subtask[]
  ) => {
    onAdd(taskText, taskPriority, taskDueDate, taskAssignedTo, subtasks, undefined, undefined, undefined, undefined, null, selectedProjectId);
    if (currentUserId) {
      updateLastTaskDefaults(currentUserId, taskPriority, taskAssignedTo);
    }
    setShowModal(false);
    resetForm();
  };

  const handleModalClose = () => {
    setShowModal(false);
    setParsedResult(null);
    setIsProcessing(false);
  };

  const resetForm = () => {
    setText('');
    setPriority('medium');
    setDueDate('');
    setReminderAt(null);
    setAssignedTo('');
    setSelectedProjectId(undefined);
    setParsedResult(null);
    setTemplateSubtasks([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isProcessing) handleAiClick();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (text.trim()) { resetForm(); } else { textareaRef.current?.blur(); }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (text.trim() && !isProcessing) {
        const subtasks = templateSubtasks.length > 0 ? templateSubtasks : undefined;
        onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined, subtasks, undefined, undefined, reminderAt || undefined, undefined, null, selectedProjectId);
        if (currentUserId) {
          updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
        }
        resetForm();
      }
    }
  };

  // Handle saved template selection
  const handleTemplateSelect = useCallback((
    templateText: string,
    templatePriority: TodoPriority,
    templateAssignedTo?: string,
    newTemplateSubtasks?: Subtask[]
  ) => {
    setText(templateText);
    setPriority(templatePriority);
    if (templateAssignedTo && users.includes(templateAssignedTo)) {
      setAssignedTo(templateAssignedTo);
    }
    setTemplateSubtasks(newTemplateSubtasks?.length ? newTemplateSubtasks : []);
    setShowTemplatePicker(false);
    textareaRef.current?.focus();
    toast.success('Template applied', { description: 'Review and adjust fields as needed' });
  }, [users, toast]);

  // Cmd+T for template picker
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't' && textareaRef.current === e.target) {
        e.preventDefault();
        setShowTemplatePicker(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // File drag-and-drop
  const isValidFileType = (file: File) => {
    const type = file.type;
    const name = file.name.toLowerCase();
    return type.startsWith('audio/') || type.startsWith('image/') || type === 'application/pdf' ||
      !!name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac|pdf|jpg|jpeg|png|gif|webp)$/);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFileType(file)) {
      setDraggedFile(file);
      setShowFileImporter(true);
    }
  };

  const priorityConfig = PRIORITY_CONFIG[priority];

  return (
    <>
      <form
        onSubmit={handleQuickAdd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="form"
        aria-label="Create new task"
        className={`rounded-xl border shadow-sm overflow-hidden transition-all relative bg-[var(--surface)] ${
          isDraggingFile
            ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]'
            : 'border-[var(--border)] focus-within:border-[var(--accent)]/60 focus-within:shadow-md'
        }`}
      >
        {/* File drop overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[var(--accent-light)] backdrop-blur-sm" role="status" aria-live="polite">
            <div className="text-center">
              <Upload className="w-6 h-6 mx-auto mb-1.5 text-[var(--accent)]" />
              <p className="font-medium text-sm text-[var(--accent)]">Drop to import</p>
              <p className="text-xs text-[var(--text-muted)]">Audio, PDF, or Image</p>
            </div>
          </div>
        )}

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Listening...' : 'What needs to be done?'}
            rows={1}
            disabled={isProcessing}
            aria-label="New task description"
            className={`w-full px-4 py-3.5 pr-10 resize-none text-sm text-[var(--foreground)] placeholder-[var(--text-light)] bg-transparent transition-all focus:outline-none ${
              isRecording ? 'ring-1 ring-inset ring-red-400/50' : ''
            }`}
            style={{ maxHeight: '160px' }}
          />
          {text.trim() && !isProcessing && (
            <button
              type="button"
              onClick={resetForm}
              className="absolute right-2.5 top-3 p-1 rounded-md text-[var(--text-light)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Clear"
              title="Clear (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Compact toolbar */}
        <div className="flex items-center gap-1.5 px-3 pb-3 pt-0.5 flex-wrap">
          {/* Priority */}
          <div
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer hover:brightness-110"
            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.color + '12' }}
          >
            <Flag className="w-3 h-3" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              aria-label="Priority"
              className="bg-transparent text-xs font-medium cursor-pointer focus:outline-none appearance-none"
              style={{ color: 'inherit' }}
            >
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Due date */}
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            dueDate ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
          }`}>
            <Calendar className="w-3 h-3" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="bg-transparent text-xs font-medium cursor-pointer focus:outline-none w-[90px]"
              style={{ color: 'inherit' }}
            />
          </div>

          {/* Assignee */}
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            assignedTo ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
          }`}>
            <User className="w-3 h-3" />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              aria-label="Assign to"
              className="bg-transparent text-xs font-medium cursor-pointer focus:outline-none appearance-none max-w-[80px]"
              style={{ color: 'inherit' }}
            >
              <option value="">Assign</option>
              {users.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          {storeProjects.length > 0 && (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              selectedProjectId ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}>
              <FolderKanban className="w-3 h-3" />
              <ProjectSelector
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                projects={storeProjects}
                placeholder="Project"
              />
            </div>
          )}

          {/* Reminder */}
          <ReminderPicker
            value={reminderAt || undefined}
            dueDate={dueDate || undefined}
            onChange={(time) => setReminderAt(time)}
            compact
          />

          <div className="flex-1" />

          {/* Template subtask badge */}
          {templateSubtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setTemplateSubtasks([])}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-colors"
              aria-label={`${templateSubtasks.length} subtasks will be added. Click to remove.`}
            >
              <ListChecks className="w-3 h-3" />
              <span>{templateSubtasks.length} subtasks</span>
              <X className="w-3 h-3 ml-0.5 opacity-60" />
            </button>
          )}

          {/* AI Features */}
          <AIFeaturesMenu
            onSmartParse={handleAiClick}
            onVoiceInput={toggleRecording}
            onFileImport={() => setShowFileImporter(true)}
            disabled={isProcessing}
            voiceSupported={speechSupported}
          />

          {/* Templates */}
          <TemplatePicker
            currentUserName={currentUserId || ''}
            users={users}
            darkMode={darkMode}
            compact={true}
            isOpen={showTemplatePicker}
            onOpenChange={setShowTemplatePicker}
            onSelectTemplate={handleTemplateSelect}
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={!text.trim() || isProcessing}
            className="ml-1 px-3.5 py-1.5 rounded-lg bg-[var(--brand-blue)] hover:bg-[var(--brand-navy)] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95"
            aria-label={text.trim() ? `Add task: ${text.substring(0, 50)}` : 'Add task'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </form>

      {/* Smart Parse Modal */}
      {showModal && parsedResult && (
        <SmartParseModal
          isOpen={showModal}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          parsedResult={{
            ...parsedResult,
            subtasks: parsedResult.subtasks.map(st => ({ ...st, included: true })),
          }}
          users={users}
          isLoading={isProcessing}
        />
      )}

      {/* AI Loading indicator */}
      {showModal && !parsedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleModalClose} />
          <div className="relative rounded-xl shadow-xl p-6 bg-[var(--surface)] text-center">
            <div className="relative mx-auto w-12 h-12 mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--brand-sky)] animate-ping opacity-20" />
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
            </div>
            <p className="font-medium text-sm text-[var(--foreground)]">Analyzing task...</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Suggesting subtasks and priority</p>
            <button
              type="button"
              onClick={handleModalClose}
              className="mt-3 px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors rounded-md hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File Importer Modal */}
      {showFileImporter && (
        <FileImporter
          onClose={() => { setShowFileImporter(false); setDraggedFile(null); }}
          onCreateTask={(fileText, filePriority, fileDueDate, fileAssignedTo, fileSubtasks, transcription, sourceFile) => {
            onAdd(fileText, filePriority, fileDueDate, fileAssignedTo, fileSubtasks, transcription, sourceFile, undefined, undefined, null, selectedProjectId);
            setShowFileImporter(false);
            setDraggedFile(null);
          }}
          users={users}
          darkMode={darkMode}
          initialFile={draggedFile}
        />
      )}
    </>
  );
}
