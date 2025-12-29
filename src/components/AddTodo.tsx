'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Loader2, Mic, MicOff, ChevronDown, Upload } from 'lucide-react';
import SmartParseModal from './SmartParseModal';
import VoiceRecordingIndicator from './VoiceRecordingIndicator';
import FileImporter from './FileImporter';
import { TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { getUserPreferences, updateLastTaskDefaults } from '@/lib/userPreferences';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string) => void;
  users: string[];
  darkMode?: boolean;
  currentUserId?: string;
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

export default function AddTodo({ onAdd, users, darkMode = true, currentUserId }: AddTodoProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);

  // Load user preferences on mount
  useEffect(() => {
    if (currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      if (prefs.lastPriority) {
        setPriority(prefs.lastPriority);
      }
      if (prefs.lastAssignedTo && users.includes(prefs.lastAssignedTo)) {
        setAssignedTo(prefs.lastAssignedTo);
      }
    }
  }, [currentUserId, users]);

  // AI modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);

  // File importer state
  const [showFileImporter, setShowFileImporter] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Check speech support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  // Smart parse API call
  const smartParse = useCallback(async (inputText: string): Promise<SmartParseResult | null> => {
    try {
      const response = await fetch('/api/ai/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, users }),
      });

      if (!response.ok) {
        console.error('Failed to smart parse');
        return null;
      }

      const data = await response.json();
      if (data.success && data.result) {
        return data.result as SmartParseResult;
      }
      return null;
    } catch (error) {
      console.error('Error in smart parse:', error);
      return null;
    }
  }, [users]);

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
          console.error('Speech recognition error:', event.error);
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
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      setShowOptions(true);
    }
  };

  // Quick add without AI
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
    // Save preferences for next time
    if (currentUserId) {
      updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
    }
    resetForm();
  };

  // Check if input might benefit from AI parsing
  const isComplexInput = () => {
    const lines = text.split('\n').filter(l => l.trim());
    const hasBullets = /^[\s]*[-•*\d.)\]]\s/.test(text);
    return text.length > 50 || lines.length > 2 || hasBullets;
  };

  // AI button - opens modal with parsed results
  const handleAiClick = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setShowModal(true);

    const result = await smartParse(text.trim());

    if (result) {
      setParsedResult(result);
    } else {
      // Fallback: create simple result from original text
      setParsedResult({
        mainTask: {
          text: text.trim(),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        },
        subtasks: [],
        summary: '',
        wasComplex: false,
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
    onAdd(taskText, taskPriority, taskDueDate, taskAssignedTo, subtasks);
    // Save preferences for next time
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
    setAssignedTo('');
    setShowOptions(false);
    setParsedResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isProcessing) {
        onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
        // Save preferences for next time
        if (currentUserId) {
          updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
        }
        resetForm();
      }
    }
  };

  // File drag-and-drop handlers
  const isValidFileType = (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type;
    return (
      type.startsWith('audio/') ||
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac|pdf|jpg|jpeg|png|gif|webp)$/)
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set to false if we're leaving the form entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
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
        className={`rounded-[var(--radius-xl)] border shadow-[var(--shadow-sm)] overflow-hidden transition-all duration-300 relative bg-[var(--surface)] border-[var(--border)] ${
          isDraggingFile ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : 'hover:shadow-[var(--shadow-md)] hover:border-[var(--border-hover)]'
        }`}
      >
        {/* File drop overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-xl)] bg-[var(--accent-light)] backdrop-blur-sm">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--accent)]" />
              <p className="font-medium text-sm text-[var(--accent)]">
                Drop to import file
              </p>
              <p className="text-xs mt-0.5 text-[var(--text-muted)]">
                Audio, PDF, or Image
              </p>
            </div>
          </div>
        )}

        {/* Main input area */}
        <div className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setShowOptions(true)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Speak your task..." : "Add a task... (paste text for AI help)"}
                rows={1}
                disabled={isProcessing}
                aria-label="New task description"
                className={`input-refined w-full px-4 py-3 resize-none text-sm min-h-[48px] text-[var(--foreground)] placeholder-[var(--text-light)] ${
                  isRecording ? 'border-[var(--danger)] ring-2 ring-[var(--danger-light)]' : ''
                }`}
                style={{ maxHeight: '120px' }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5 flex-shrink-0">
              {/* File import button (voicemail, PDF, image) */}
              <button
                type="button"
                onClick={() => setShowFileImporter(true)}
                disabled={isProcessing}
                className="p-2.5 rounded-[var(--radius-lg)] transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center touch-manipulation bg-[var(--accent-light)] text-[var(--accent)] hover:bg-[var(--accent)]/20 active:scale-95 disabled:opacity-50"
                aria-label="Import file"
                title="Import voicemail, PDF, or image to create task"
              >
                <Upload className="w-5 h-5" />
              </button>

              {/* Voice input - only show if supported */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-[var(--radius-lg)] transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center touch-manipulation ${
                    isRecording
                      ? 'bg-[var(--danger)] text-white animate-pulse'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
                  } active:scale-95 disabled:opacity-50`}
                  aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                  aria-pressed={isRecording}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              {/* AI button - prominent when complex input detected */}
              {text.trim() && (
                <button
                  type="button"
                  onClick={handleAiClick}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-[var(--radius-lg)] transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center touch-manipulation ${
                    isComplexInput()
                      ? 'bg-[var(--accent)] text-white hover:opacity-90 shadow-[var(--shadow-blue)]'
                      : 'bg-[var(--accent-light)] text-[var(--accent)] hover:bg-[var(--accent)]/20'
                  } active:scale-95 disabled:opacity-50`}
                  aria-label="Parse with AI"
                  title={isComplexInput() ? 'Complex input detected - AI can help' : 'Parse with AI'}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </button>
              )}

              {/* Add button */}
              <button
                type="submit"
                disabled={!text.trim() || isProcessing}
                className="px-5 py-2.5 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200 min-h-[48px] flex items-center gap-2 touch-manipulation shadow-[var(--shadow-blue)] active:scale-95"
                aria-label="Add task"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Voice recording indicator */}
        {isRecording && (
          <div className="px-3 pb-2 flex justify-center">
            <VoiceRecordingIndicator isRecording={isRecording} darkMode={darkMode} />
          </div>
        )}

        {/* Options row - visible when focused or has content */}
        {(showOptions || text) && (
          <div className="px-4 pb-4 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-3">
            {/* Priority */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-hover)] transition-colors">
              <Flag className="w-4 h-4 flex-shrink-0" style={{ color: priorityConfig.color }} />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriority)}
                aria-label="Priority"
                className="bg-transparent text-sm font-medium cursor-pointer focus:outline-none"
                style={{ color: priorityConfig.color }}
              >
                <option value="low" className="text-[var(--foreground)] bg-[var(--surface)]">Low</option>
                <option value="medium" className="text-[var(--foreground)] bg-[var(--surface)]">Medium</option>
                <option value="high" className="text-[var(--foreground)] bg-[var(--surface)]">High</option>
                <option value="urgent" className="text-[var(--foreground)] bg-[var(--surface)]">Urgent</option>
              </select>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-hover)] transition-colors">
              <Calendar className="w-4 h-4 flex-shrink-0 text-[var(--text-muted)]" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
                className={`bg-transparent text-sm cursor-pointer focus:outline-none ${
                  dueDate ? 'text-[var(--foreground)]' : 'text-[var(--text-muted)]'
                }`}
              />
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-hover)] transition-colors">
              <User className="w-4 h-4 flex-shrink-0 text-[var(--text-muted)]" />
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                aria-label="Assign to"
                className={`bg-transparent text-sm cursor-pointer focus:outline-none ${
                  assignedTo ? 'text-[var(--foreground)]' : 'text-[var(--text-muted)]'
                }`}
              >
                <option value="" className="text-[var(--foreground)] bg-[var(--surface)]">Unassigned</option>
                {users.map((user) => (
                  <option key={user} value={user} className="text-[var(--foreground)] bg-[var(--surface)]">{user}</option>
                ))}
              </select>
            </div>
          </div>
        )}
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

      {/* Loading modal while processing */}
      {showModal && !parsedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Processing">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] p-8 bg-[var(--surface)]">
            <div className="text-center">
              <div className="relative inline-block">
                <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin mx-auto mb-3" />
                <div className="absolute inset-0 bg-[var(--accent)]/20 rounded-full blur-xl animate-pulse" />
              </div>
              <p className="text-[var(--text-muted)]">Analyzing your input...</p>
            </div>
          </div>
        </div>
      )}

      {/* File Importer Modal (voicemail, PDF, image) */}
      {showFileImporter && (
        <FileImporter
          onClose={() => {
            setShowFileImporter(false);
            setDraggedFile(null);
          }}
          onCreateTask={(text, priority, dueDate, assignedTo, subtasks, transcription) => {
            onAdd(text, priority, dueDate, assignedTo, subtasks, transcription);
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
