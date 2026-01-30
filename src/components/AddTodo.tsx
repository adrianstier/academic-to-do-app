'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, Flag, User, Sparkles, Loader2, Mic, MicOff, Upload, X, Bell } from 'lucide-react';
import SmartParseModal from './SmartParseModal';
import ReminderPicker from './ReminderPicker';
import VoiceRecordingIndicator from './VoiceRecordingIndicator';
import FileImporter from './FileImporter';
import { QuickTaskButtons, useTaskPatterns } from './QuickTaskButtons';
import { CategoryConfidenceIndicator } from './CategoryConfidenceIndicator';
import { TodoPriority, Subtask, PRIORITY_CONFIG, QuickTaskTemplate } from '@/types/todo';
import { getUserPreferences, updateLastTaskDefaults } from '@/lib/userPreferences';
import { analyzeTaskPattern } from '@/lib/academicPatterns';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';
import { useToast } from './ui/Toast';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string, sourceFile?: File, reminderAt?: string) => void;
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

  // Initialize priority and assignedTo from user preferences (lazy initial state)
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
  const [assignedTo, setAssignedTo] = useState(() => {
    if (typeof window !== 'undefined' && currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      if (prefs.lastAssignedTo && users.includes(prefs.lastAssignedTo)) {
        return prefs.lastAssignedTo;
      }
    }
    return '';
  });
  const [showOptions, setShowOptions] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);


  // AI modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);

  // File importer state
  const [showFileImporter, setShowFileImporter] = useState(false);

  // Quick task template state (Feature 4)
  const { patterns } = useTaskPatterns();
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<string[]>([]);

  // AI Pattern detection state (Feature 4 - CategoryConfidenceIndicator)
  const [patternDismissed, setPatternDismissed] = useState(false);

  // Compute pattern match using useMemo instead of useEffect + setState
  const computedPatternMatch = useMemo(() => {
    if (text.length > 10 && suggestedSubtasks.length === 0) {
      return analyzeTaskPattern(text);
    }
    return null;
  }, [text, suggestedSubtasks.length]);

  // patternMatch is null if dismissed, otherwise use computed value
  const patternMatch = patternDismissed ? null : computedPatternMatch;

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
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Handle accepting AI suggestions
  const handleAcceptSuggestions = useCallback(() => {
    if (patternMatch) {
      setPriority(patternMatch.suggestedPriority);
      // Only add subtasks if none are currently set
      if (patternMatch.suggestedSubtasks.length > 0 && suggestedSubtasks.length === 0) {
        setSuggestedSubtasks(patternMatch.suggestedSubtasks);
      }
    }
    setPatternDismissed(true);
  }, [patternMatch, suggestedSubtasks.length]);

  // Handle dismissing AI suggestions
  const handleDismissSuggestions = useCallback(() => {
    setPatternDismissed(true);
  }, []);

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

    // Convert suggested subtasks to proper Subtask objects
    const subtasks: Subtask[] = suggestedSubtasks.length > 0
      ? suggestedSubtasks.map((text, index) => ({
          id: `subtask-${Date.now()}-${index}`,
          text,
          completed: false,
          priority: 'medium' as TodoPriority,
        }))
      : undefined as unknown as Subtask[];

    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined, subtasks || undefined, undefined, undefined, reminderAt || undefined);
    // Save preferences for next time
    if (currentUserId) {
      updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
    }
    resetForm();
    setSuggestedSubtasks([]); // Clear suggested subtasks after creating
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
    setReminderAt(null);
    setAssignedTo('');
    setShowOptions(false);
    setParsedResult(null);
    setSuggestedSubtasks([]);
    setPatternDismissed(false); // Reset so new pattern can be detected on next input
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter - Submit with AI enhancement
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isProcessing) {
        handleAiClick();
      }
      return;
    }

    // Enter (without modifiers) - Quick add
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
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

  // Handle quick task template selection (Feature 4)
  const handleQuickTaskSelect = (template: QuickTaskTemplate) => {
    setText(template.text);
    setPriority(template.defaultPriority);
    setSuggestedSubtasks(template.suggestedSubtasks);
    setShowOptions(true);
    // Focus the textarea so user can edit the placeholder
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Select the [customer] placeholder if present
      const placeholderMatch = template.text.match(/\[[\w\s]+\]/);
      if (placeholderMatch) {
        const start = template.text.indexOf(placeholderMatch[0]);
        const end = start + placeholderMatch[0].length;
        setTimeout(() => {
          textareaRef.current?.setSelectionRange(start, end);
        }, 0);
      }
    }
  };

  return (
    <>
      {/* AI Pattern Detection Indicator (Feature 4) */}
      <CategoryConfidenceIndicator
        patternMatch={patternMatch}
        onDismiss={handleDismissSuggestions}
        onAcceptSuggestions={handleAcceptSuggestions}
      />

      <form
        onSubmit={handleQuickAdd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="form"
        aria-label="Create new task"
        className={`rounded-[var(--radius-xl)] border-2 shadow-[var(--shadow-md)] overflow-hidden transition-all duration-300 relative bg-[var(--surface)] border-[var(--accent)]/25 ${
          isDraggingFile ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : 'hover:shadow-[var(--shadow-lg)] hover:border-[var(--accent)]/40 focus-within:border-[var(--accent)]/60 focus-within:shadow-[var(--shadow-lg)]'
        }`}
      >
        {/* Brand accent bar - adds visual warmth */}
        <div className="h-1 bg-gradient-to-r from-[var(--brand-blue)] via-[var(--brand-sky)] to-[var(--brand-blue)]" />
        {/* File drop overlay */}
        {isDraggingFile && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-xl)] bg-[var(--accent-light)] backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-label="Drop zone active - release to import file"
          >
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--accent)]" aria-hidden="true" />
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
        <div className="p-5 pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => {
                  setShowOptions(true);
                  setIsInputFocused(true);
                }}
                onBlur={() => {
                  // Delay hiding to allow clicking quick task buttons
                  setTimeout(() => setIsInputFocused(false), 150);
                }}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Speak your task..." : "What needs to be done? Describe your task here..."}
                rows={3}
                disabled={isProcessing}
                aria-label="New task description"
                className={`w-full px-5 py-4 pr-12 resize-none text-base min-h-[100px] text-[var(--foreground)] placeholder-[var(--text-light)] font-medium rounded-[var(--radius-lg)] border border-white/10 bg-[var(--surface)] transition-all duration-200 focus:outline-none focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-[var(--accent-light)] focus:shadow-[inset_0_2px_4px_rgba(0,51,160,0.03)] ${
                  isRecording ? 'border-[var(--danger)] ring-2 ring-[var(--danger-light)]' : ''
                }`}
                style={{ maxHeight: '200px' }}
              />
              {/* Clear button - appears when there's text */}
              {text.trim() && !isProcessing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="absolute right-3 top-3 p-1.5 rounded-full text-[var(--text-light)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  aria-label="Clear form and reset all fields"
                  title="Clear form (Esc)"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Action buttons - grouped dock style */}
            <div className="flex gap-3 flex-shrink-0 items-center justify-between">
              {/* Secondary actions grouped in a subtle container */}
              <div className="flex items-center gap-0.5 p-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                {/* File import button */}
                <button
                  type="button"
                  onClick={() => setShowFileImporter(true)}
                  disabled={isProcessing}
                  className="p-2.5 rounded-full transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] active:scale-95 disabled:opacity-50"
                  aria-label="Import file"
                  title="Import voicemail, PDF, or image"
                >
                  <Upload className="w-4.5 h-4.5" />
                </button>

                {/* Voice input - only show if supported */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isProcessing}
                    className={`p-2.5 rounded-full transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation ${
                      isRecording
                        ? 'bg-[var(--danger)] text-white animate-pulse'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
                    } active:scale-95 disabled:opacity-50`}
                    aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                    aria-pressed={isRecording}
                  >
                    {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
                  </button>
                )}

                {/* Separator and AI button when text is present */}
                {text.trim() && (
                  <>
                    <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
                    <button
                      type="button"
                      onClick={handleAiClick}
                      disabled={isProcessing}
                      className={`p-2.5 rounded-full transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation ${
                        isComplexInput()
                          ? 'bg-[var(--accent)] text-white shadow-sm'
                          : 'text-[var(--accent)] hover:bg-[var(--accent-light)]'
                      } active:scale-95 disabled:opacity-50`}
                      aria-label="Parse with AI"
                      title={isComplexInput() ? 'Complex input - AI can help organize' : 'Use AI to parse'}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-4.5 h-4.5" />
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Primary Add button - elevated with shadow for prominence */}
              <button
                type="submit"
                disabled={!text.trim() || isProcessing}
                className="px-5 py-2.5 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-light)] hover:from-[var(--brand-navy)] hover:to-[var(--brand-blue)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200 min-h-[48px] flex items-center gap-2 touch-manipulation shadow-[0_2px_8px_rgba(0,51,160,0.35)] hover:shadow-[0_4px_12px_rgba(0,51,160,0.45)] active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                aria-label={text.trim() ? `Add task: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}` : 'Add task (enter task description first)'}
                aria-disabled={!text.trim() || isProcessing}
              >
                <Plus className="w-5 h-5" aria-hidden="true" />
                <span className="hidden sm:inline tracking-tight">Add</span>
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

        {/* Quick Task Buttons - shown when input is focused or has content */}
        <AnimatePresence>
          {(isInputFocused || text) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden border-t border-[var(--border-subtle)]"
            >
              <div className="px-5 pt-5 pb-5">
                <QuickTaskButtons
                  onSelectTemplate={handleQuickTaskSelect}
                  patterns={patterns}
                  inline
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Options row - visible when focused or has content */}
        {(showOptions || text) && (
          <div className="px-5 pb-6 pt-5 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-4">
              {/* Priority - improved pill proportions */}
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border-2 transition-all cursor-pointer hover:shadow-sm"
                style={{
                  borderColor: priorityConfig.color + '40',
                  backgroundColor: priorityConfig.color + '08'
                }}
              >
                <Flag className="w-4 h-4 flex-shrink-0" style={{ color: priorityConfig.color }} />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TodoPriority)}
                  aria-label="Priority"
                  className="bg-transparent text-sm font-semibold cursor-pointer focus:outline-none appearance-none pr-1"
                  style={{ color: priorityConfig.color }}
                >
                  <option value="low" className="text-[var(--foreground)] bg-[var(--surface)]">Low</option>
                  <option value="medium" className="text-[var(--foreground)] bg-[var(--surface)]">Medium</option>
                  <option value="high" className="text-[var(--foreground)] bg-[var(--surface)]">High</option>
                  <option value="urgent" className="text-[var(--foreground)] bg-[var(--surface)]">Urgent</option>
                </select>
              </div>

              {/* Due date - improved pill with quick date chips */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border-2 transition-all cursor-pointer hover:shadow-sm ${
                dueDate
                  ? 'border-[var(--accent)]/40 bg-[var(--accent-light)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-hover)]'
              }`}>
                <Calendar className={`w-4 h-4 flex-shrink-0 ${dueDate ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label="Due date"
                  className={`bg-transparent text-sm font-medium cursor-pointer focus:outline-none w-[100px] ${
                    dueDate ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                />
              </div>

              {/* Assignee - improved pill proportions */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border-2 transition-all cursor-pointer hover:shadow-sm ${
                assignedTo
                  ? 'border-[var(--success)]/40 bg-[var(--success)]/08'
                  : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-hover)]'
              }`}>
                <User className={`w-4 h-4 flex-shrink-0 ${assignedTo ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`} />
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  aria-label="Assign to"
                  className={`bg-transparent text-sm font-medium cursor-pointer focus:outline-none appearance-none pr-1 ${
                    assignedTo ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  <option value="" className="text-[var(--foreground)] bg-[var(--surface)]">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user} className="text-[var(--foreground)] bg-[var(--surface)]">{user}</option>
                  ))}
                </select>
              </div>

              {/* Reminder - pill style */}
              <ReminderPicker
                value={reminderAt || undefined}
                dueDate={dueDate || undefined}
                onChange={(time) => setReminderAt(time)}
                compact
              />
            </div>
          </div>
        )}

        {/* Suggested Subtasks with visual hierarchy */}
        {suggestedSubtasks.length > 0 && (
          <div className="px-5 pb-5 border-t border-[var(--border-subtle)]" role="region" aria-label="Suggested subtasks">
            <div className="flex items-center justify-between mb-4 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[var(--foreground)]" id="subtasks-heading">
                  Suggested Subtasks
                </span>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full" aria-label={`${suggestedSubtasks.length} subtasks`}>
                  {suggestedSubtasks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSuggestedSubtasks([])}
                className="text-xs text-[var(--text-light)] hover:text-[var(--danger)] transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded px-1"
                aria-label="Clear all suggested subtasks"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                Clear all
              </button>
            </div>
            <ul className="space-y-2.5" aria-labelledby="subtasks-heading" role="list">
              {suggestedSubtasks.map((subtask, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 text-sm px-4 py-3 rounded-xl border-l-3 transition-all hover:bg-[var(--surface-2)]"
                  style={{
                    borderLeftColor: `rgba(0, 51, 160, ${0.4 + index * 0.15})`,
                    background: `linear-gradient(90deg, rgba(0, 51, 160, 0.03) 0%, transparent 50%)`
                  }}
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-[var(--foreground)]">{subtask}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-muted)] mt-3 flex items-center gap-1.5" role="note">
              <Sparkles className="w-3 h-3 text-[var(--accent)]" aria-hidden="true" />
              These will be added automatically when you create the task
            </p>
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

      {/* Loading modal with brand personality */}
      {showModal && !parsedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ai-processing-title" aria-describedby="ai-processing-desc">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] p-8 bg-[var(--surface)] min-w-[280px]">
            <div className="text-center space-y-4">
              {/* Animated brand rings */}
              <div className="relative mx-auto w-16 h-16" aria-hidden="true">
                <div className="absolute inset-0 rounded-full border-2 border-[var(--brand-sky)] animate-ping opacity-20" />
                <div className="absolute inset-2 rounded-full border-2 border-[var(--brand-blue)] animate-ping opacity-30 animation-delay-150" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center shadow-[var(--shadow-blue)]">
                  <Sparkles className="w-7 h-7 text-white animate-pulse" />
                </div>
              </div>
              <div role="status" aria-live="polite">
                <p id="ai-processing-title" className="font-semibold text-[var(--foreground)]">Understanding your task...</p>
                <p id="ai-processing-desc" className="text-sm text-[var(--text-muted)] mt-1">We'll suggest subtasks and priority</p>
              </div>
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
          onCreateTask={(text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile) => {
            onAdd(text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile);
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
