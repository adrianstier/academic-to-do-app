'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Loader2,
  Check,
  Mail,
  FileAudio,
  Sparkles,
  Trash2,
  Flag,
  Clock,
  Upload,
  FileText,
  Mic,
  MicOff
} from 'lucide-react';
import { Subtask, TodoPriority } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';

interface ParsedSubtask {
  text: string;
  priority: TodoPriority;
  estimatedMinutes?: number;
  selected: boolean;
}

interface ContentToSubtasksImporterProps {
  onClose: () => void;
  onAddSubtasks: (subtasks: Subtask[]) => void;
  parentTaskText: string;
}

type ImportMode = 'email' | 'voicemail' | 'live-mic' | null;
type ProcessingStatus = 'idle' | 'recording' | 'transcribing' | 'parsing' | 'ready' | 'error';

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

export default function ContentToSubtasksImporter({
  onClose,
  onAddSubtasks,
  parentTaskText
}: ContentToSubtasksImporterProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [mode, setMode] = useState<ImportMode>(null);
  const [emailContent, setEmailContent] = useState('');
  const [transcription, setTranscription] = useState('');
  const [subtasks, setSubtasks] = useState<ParsedSubtask[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live mic recording state
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
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
            // Interim results are available but not stored
          }

          if (finalTranscript) {
            setLiveTranscript(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onerror = (event) => {
          logger.error('Speech recognition error', undefined, { component: 'ContentToSubtasksImporter', error: event.error });
          setIsRecording(false);
          setError('Speech recognition error: ' + event.error);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setLiveTranscript('');
      setError('');
      recognitionRef.current.start();
      setIsRecording(true);
      setStatus('recording');
    }
  };

  const handleLiveMicParse = async () => {
    if (!liveTranscript.trim()) {
      setError('Please record some audio first');
      return;
    }

    setStatus('parsing');
    setError('');
    setTranscription(liveTranscript);

    try {
      const response = await fetchWithCsrf('/api/ai/parse-content-to-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: liveTranscript,
          contentType: 'voicemail',
          parentTaskText,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse audio');
      }

      const parsedSubtasks: ParsedSubtask[] = data.subtasks.map((st: {
        text: string;
        priority: string;
        estimatedMinutes?: number;
      }) => ({
        ...st,
        priority: st.priority as TodoPriority,
        selected: true,
      }));

      setSubtasks(parsedSubtasks);
      setSummary(data.summary || '');
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse audio');
      setStatus('error');
    }
  };

  const handleEmailParse = async () => {
    if (!emailContent.trim()) {
      setError('Please paste email content first');
      return;
    }

    setStatus('parsing');
    setError('');

    try {
      const response = await fetchWithCsrf('/api/ai/parse-content-to-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: emailContent,
          contentType: 'email',
          parentTaskText,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse email');
      }

      const parsedSubtasks: ParsedSubtask[] = data.subtasks.map((st: {
        text: string;
        priority: string;
        estimatedMinutes?: number;
      }) => ({
        ...st,
        priority: st.priority as TodoPriority,
        selected: true,
      }));

      setSubtasks(parsedSubtasks);
      setSummary(data.summary || '');
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse email');
      setStatus('error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - accept audio MIME types or known audio extensions
    // Also accept video/mp4 and video/webm as they can contain audio
    const isAudioMime = file.type.startsWith('audio/') || file.type === 'video/mp4' || file.type === 'video/webm';
    const hasAudioExtension = file.name.match(/\.(mp3|mp4|wav|m4a|ogg|webm|aac|flac|mpeg|mpga)$/i);
    if (!isAudioMime && !hasAudioExtension) {
      setError('Please select an audio file (MP3, WAV, M4A, MP4, etc.)');
      return;
    }

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be under 25MB');
      return;
    }

    setStatus('transcribing');
    setError('');

    try {
      // Single API call: transcribe + extract subtasks
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('mode', 'subtasks');
      formData.append('parentTaskText', parentTaskText);

      const response = await fetchWithCsrf('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process audio');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to process audio');
      }

      setTranscription(data.text || '');

      const parsedSubtasks: ParsedSubtask[] = (data.subtasks || []).map((st: {
        text: string;
        priority: string;
        estimatedMinutes?: number;
      }) => ({
        ...st,
        priority: st.priority as TodoPriority,
        selected: true,
      }));

      setSubtasks(parsedSubtasks);
      setSummary(data.summary || '');
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      setStatus('error');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSubtask = (index: number) => {
    setSubtasks(prev => prev.map((st, i) =>
      i === index ? { ...st, selected: !st.selected } : st
    ));
  };

  const updateSubtask = (index: number, updates: Partial<ParsedSubtask>) => {
    setSubtasks(prev => prev.map((st, i) =>
      i === index ? { ...st, ...updates } : st
    ));
  };

  const removeSubtask = (index: number) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSelected = () => {
    const selectedSubtasks: Subtask[] = subtasks
      .filter(st => st.selected && st.text.trim())
      .map(st => ({
        id: uuidv4(),
        text: st.text.trim(),
        completed: false,
        priority: st.priority,
        estimatedMinutes: st.estimatedMinutes,
      }));

    if (selectedSubtasks.length === 0) {
      setError('Please select at least one subtask');
      return;
    }

    onAddSubtasks(selectedSubtasks);
    onClose();
  };

  const totalSelected = subtasks.filter(st => st.selected).length;

  const resetToModeSelection = () => {
    setMode(null);
    setEmailContent('');
    setTranscription('');
    setSubtasks([]);
    setStatus('idle');
    setError('');
    setSummary('');
    setLiveTranscript('');
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Import as Subtasks">
      <div className="bg-white dark:bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-[var(--accent)]/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-[var(--foreground)]">Import as Subtasks</h2>
              <p className="text-sm text-slate-500 dark:text-[var(--text-muted)]">Extract action items from emails or voicemails</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[var(--surface-2)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Parent task context */}
          <div className="mb-4 p-3 bg-slate-50 dark:bg-[var(--surface-2)] rounded-lg">
            <p className="text-xs text-slate-500 dark:text-[var(--text-muted)] mb-1">Adding subtasks to:</p>
            <p className="text-sm font-medium text-slate-700 dark:text-[var(--foreground)] truncate">{parentTaskText}</p>
          </div>

          {/* Mode selection */}
          {!mode && (
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setMode('email')}
                className="p-6 border-2 border-slate-200 dark:border-[var(--border)] rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-[var(--accent)]/10 transition-all group"
              >
                <Mail className="w-10 h-10 text-slate-400 dark:text-[var(--text-muted)] group-hover:text-indigo-500 dark:group-hover:text-[var(--accent)] mx-auto mb-3 transition-colors" />
                <p className="font-medium text-slate-700 dark:text-[var(--foreground)] group-hover:text-indigo-700">Paste Email</p>
                <p className="text-sm text-slate-500 dark:text-[var(--text-muted)] mt-1">Paste text content</p>
              </button>
              <button
                onClick={() => setMode('voicemail')}
                className="p-6 border-2 border-slate-200 dark:border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 dark:hover:bg-[var(--accent)]/10 transition-all group"
              >
                <FileAudio className="w-10 h-10 text-slate-400 dark:text-[var(--text-muted)] group-hover:text-[var(--accent)] mx-auto mb-3 transition-colors" />
                <p className="font-medium text-slate-700 dark:text-[var(--foreground)] group-hover:text-[var(--brand-navy)]">Upload Audio</p>
                <p className="text-sm text-slate-500 dark:text-[var(--text-muted)] mt-1">Upload audio file</p>
              </button>
              <button
                onClick={() => setMode('live-mic')}
                className="p-6 border-2 border-slate-200 dark:border-[var(--border)] rounded-xl hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all group"
              >
                <Mic className="w-10 h-10 text-slate-400 dark:text-[var(--text-muted)] group-hover:text-red-500 mx-auto mb-3 transition-colors" />
                <p className="font-medium text-slate-700 dark:text-[var(--foreground)] group-hover:text-red-700 dark:group-hover:text-red-400">Live Mic</p>
                <p className="text-sm text-slate-500 dark:text-[var(--text-muted)] mt-1">Speak directly</p>
              </button>
            </div>
          )}

          {/* Email input mode */}
          {mode === 'email' && status !== 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={resetToModeSelection}
                  className="text-sm text-slate-500 dark:text-[var(--text-muted)] hover:text-slate-700 dark:hover:text-[var(--foreground)]"
                >
                  &larr; Back
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[var(--foreground)] mb-2">
                  Paste email or message content
                </label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  placeholder="Paste the full email or message here..."
                  className="w-full h-48 px-4 py-3 border border-slate-200 dark:border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-[var(--accent)]/30 focus:border-indigo-400 dark:focus:border-[var(--accent)] text-sm bg-white dark:bg-[var(--surface-2)] text-slate-800 dark:text-[var(--foreground)] placeholder:text-slate-400 dark:placeholder:text-[var(--text-muted)]"
                  disabled={status === 'parsing'}
                />
                <p className="text-xs text-slate-400 dark:text-[var(--text-muted)] mt-1">
                  {emailContent.length} characters
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleEmailParse}
                disabled={!emailContent.trim() || status === 'parsing'}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-[var(--surface-2)] text-white disabled:text-slate-400 dark:disabled:text-[var(--text-muted)] rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {status === 'parsing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting action items...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract Subtasks
                  </>
                )}
              </button>
            </div>
          )}

          {/* Voicemail upload mode */}
          {mode === 'voicemail' && status !== 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={resetToModeSelection}
                  className="text-sm text-slate-500 dark:text-[var(--text-muted)] hover:text-slate-700 dark:hover:text-[var(--foreground)]"
                >
                  &larr; Back
                </button>
              </div>

              {status === 'idle' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 dark:hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
                >
                  <Upload className="w-10 h-10 text-slate-400 dark:text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="font-medium text-slate-600 dark:text-[var(--foreground)]">Click to upload audio file</p>
                  <p className="text-sm text-slate-400 dark:text-[var(--text-muted)] mt-1">MP3, WAV, M4A, OGG (max 25MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {(status === 'transcribing' || status === 'parsing') && (
                <div className="p-6 bg-slate-50 dark:bg-[var(--surface-2)] rounded-xl text-center">
                  <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mx-auto mb-3" />
                  <p className="font-medium text-slate-700 dark:text-[var(--foreground)]">
                    {status === 'transcribing' ? 'Transcribing audio...' : 'Extracting action items...'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-[var(--text-muted)] mt-1">This may take a moment</p>
                </div>
              )}

              {transcription && (
                <div className="p-3 bg-slate-50 dark:bg-[var(--surface-2)] rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-[var(--text-muted)] mb-1">Transcription:</p>
                  <p className="text-sm text-slate-600 dark:text-[var(--text-secondary)] italic line-clamp-3">&ldquo;{transcription}&rdquo;</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Live mic mode */}
          {mode === 'live-mic' && status !== 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={resetToModeSelection}
                  className="text-sm text-slate-500 dark:text-[var(--text-muted)] hover:text-slate-700 dark:hover:text-[var(--foreground)]"
                >
                  &larr; Back
                </button>
              </div>

              {/* Recording controls */}
              <div className="p-6 bg-slate-50 dark:bg-[var(--surface-2)] rounded-xl text-center">
                <button
                  onClick={toggleRecording}
                  disabled={status === 'parsing'}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-slate-200 dark:bg-[var(--surface-3)] hover:bg-slate-300 dark:hover:bg-[var(--border)]'
                  } disabled:opacity-50`}
                >
                  {isRecording ? (
                    <MicOff className="w-8 h-8 text-white" />
                  ) : (
                    <Mic className="w-8 h-8 text-slate-600 dark:text-[var(--text-muted)]" />
                  )}
                </button>
                <p className="font-medium text-slate-700 dark:text-[var(--foreground)]">
                  {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
                </p>
                <p className="text-sm text-slate-500 dark:text-[var(--text-muted)] mt-1">
                  {isRecording ? 'Speak clearly into your microphone' : 'Dictate action items for this task'}
                </p>
              </div>

              {/* Live transcript display */}
              {liveTranscript && (
                <div className="p-4 bg-white dark:bg-[var(--surface-2)] border border-slate-200 dark:border-[var(--border)] rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-[var(--text-muted)] mb-2">Live Transcript:</p>
                  <p className="text-sm text-slate-700 dark:text-[var(--foreground)]">{liveTranscript}</p>
                </div>
              )}

              {/* Processing indicator */}
              {status === 'parsing' && (
                <div className="p-4 bg-indigo-50 dark:bg-[var(--accent)]/10 rounded-xl text-center">
                  <Loader2 className="w-6 h-6 text-indigo-500 dark:text-[var(--accent)] animate-spin mx-auto mb-2" />
                  <p className="text-sm text-indigo-700 dark:text-[var(--accent)]">Extracting action items...</p>
                </div>
              )}

              {/* Extract button */}
              {liveTranscript && !isRecording && status !== 'parsing' && (
                <button
                  onClick={handleLiveMicParse}
                  className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Extract Subtasks
                </button>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Results view */}
          {status === 'ready' && subtasks.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={resetToModeSelection}
                  className="text-sm text-slate-500 dark:text-[var(--text-muted)] hover:text-slate-700 dark:hover:text-[var(--foreground)]"
                >
                  &larr; Start over
                </button>
                <span className="text-sm text-slate-500 dark:text-[var(--text-muted)]">
                  {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {summary && (
                <div className="p-3 bg-indigo-50 dark:bg-[var(--accent)]/10 rounded-lg">
                  <p className="text-sm text-indigo-700 dark:text-[var(--accent)]">{summary}</p>
                </div>
              )}

              {/* Subtasks list */}
              <div className="space-y-2">
                {subtasks.map((subtask, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-colors ${
                      subtask.selected
                        ? 'border-indigo-200 dark:border-[var(--accent)]/30 bg-indigo-50/50 dark:bg-[var(--accent)]/5'
                        : 'border-slate-200 dark:border-[var(--border)] bg-slate-50 dark:bg-[var(--surface-2)] opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSubtask(index)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          subtask.selected
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'border-slate-300 dark:border-[var(--border)]'
                        }`}
                      >
                        {subtask.selected && <Check className="w-3 h-3" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Subtask text */}
                        <input
                          type="text"
                          value={subtask.text}
                          onChange={(e) => updateSubtask(index, { text: e.target.value })}
                          className="w-full bg-white dark:bg-[var(--surface-2)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-[var(--accent)]/30 focus:border-indigo-400 dark:focus:border-[var(--accent)]"
                        />

                        {/* Options row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Flag className="w-3 h-3 text-slate-400 dark:text-[var(--text-muted)]" />
                            <select
                              value={subtask.priority}
                              onChange={(e) => updateSubtask(index, { priority: e.target.value as TodoPriority })}
                              className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface-2)] text-slate-700 dark:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-[var(--accent)]/30"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>

                          {subtask.estimatedMinutes && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-[var(--text-muted)]">
                              <Clock className="w-3 h-3" />
                              {subtask.estimatedMinutes}m
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeSubtask(index)}
                        className="p-1 text-slate-400 dark:text-[var(--text-muted)] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Empty state after processing */}
          {status === 'ready' && subtasks.length === 0 && (
            <div className="text-center py-8 text-slate-400 dark:text-[var(--text-muted)]">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No action items found</p>
              <button
                onClick={resetToModeSelection}
                className="mt-2 text-indigo-500 dark:text-[var(--accent)] hover:text-indigo-600 dark:hover:text-[var(--accent-hover)] text-sm"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'ready' && subtasks.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-[var(--border)] flex items-center justify-between flex-shrink-0">
            <span className="text-sm text-slate-500 dark:text-[var(--text-muted)]">
              {totalSelected} subtask{totalSelected !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-[var(--surface-2)] rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                disabled={totalSelected === 0}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-[var(--surface-2)] text-white disabled:text-slate-400 dark:disabled:text-[var(--text-muted)] rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Add {totalSelected} Subtask{totalSelected !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
