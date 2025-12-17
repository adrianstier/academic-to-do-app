'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Loader2, Mic, MicOff, FileAudio } from 'lucide-react';
import VoicemailImporter from './VoicemailImporter';
import SmartParseModal from './SmartParseModal';
import { TodoPriority, Subtask } from '@/types/todo';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[]) => void;
  users: string[];
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

export default function AddTodo({ onAdd, users }: AddTodoProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // AI modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showVoicemailImporter, setShowVoicemailImporter] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleAddMultipleTasks = (tasks: Array<{ text: string; priority: TodoPriority; dueDate?: string; assignedTo?: string }>) => {
    tasks.forEach(task => {
      onAdd(task.text, task.priority, task.dueDate, task.assignedTo);
    });
  };

  // Quick add without AI
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
    resetForm();
  };

  // AI button - always opens modal with parsed results
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
        resetForm();
      }
    }
  };

  return (
    <>
      <form onSubmit={handleQuickAdd} className="bg-white rounded-xl border-2 border-slate-100 overflow-hidden shadow-sm">
        <div className="flex items-start gap-3 p-3">
          <div className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0 mt-1">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-[#D4A853] animate-spin" />
            ) : isRecording ? (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            ) : (
              <Plus className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setShowOptions(true)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening... speak your task" : "What needs to be done? Paste emails or notes, then click AI"}
            className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-base resize-none overflow-y-auto min-h-[24px]"
            style={{ maxHeight: '120px' }}
            disabled={isProcessing}
            rows={1}
          />

          {/* Voice input buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isProcessing}
              className={`p-2 rounded-lg transition-colors ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setShowVoicemailImporter(true)}
              disabled={isProcessing || isRecording}
              className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Import voicemails"
            >
              <FileAudio className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            {/* AI Button - opens modal */}
            <button
              type="button"
              onClick={handleAiClick}
              disabled={!text.trim() || isProcessing}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              title="AI organizes your input into task + subtasks"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">AI</span>
            </button>

            {/* Quick Add Button */}
            <button
              type="submit"
              disabled={!text.trim() || isProcessing}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              title="Add task as-is"
            >
              Add
            </button>
          </div>
        </div>

        {/* Options row */}
        {showOptions && (
          <div className="px-4 pb-3 pt-1 border-t border-slate-100 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-slate-400" />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriority)}
                className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Voicemail Importer Modal */}
        {showVoicemailImporter && (
          <VoicemailImporter
            onClose={() => setShowVoicemailImporter(false)}
            onAddTasks={handleAddMultipleTasks}
            users={users}
          />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Analyzing your input...</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
