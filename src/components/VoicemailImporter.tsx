'use client';

import { useState, useRef } from 'react';
import {
  X,
  Loader2,
  Check,
  FileAudio,
  Sparkles,
  Trash2,
  Flag,
  Clock,
  Upload,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Plus,
  Calendar,
  User,
  AlertCircle,
} from 'lucide-react';
import { Subtask, TodoPriority, PRIORITY_CONFIG } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';

interface ParsedSubtask {
  text: string;
  priority: TodoPriority;
  estimatedMinutes?: number;
  selected: boolean;
}

interface VoicemailImporterProps {
  onClose: () => void;
  onCreateTask: (
    text: string,
    priority: TodoPriority,
    dueDate?: string,
    assignedTo?: string,
    subtasks?: Subtask[]
  ) => void;
  users: string[];
}

type ProcessingStatus = 'idle' | 'uploading' | 'transcribing' | 'parsing' | 'ready' | 'error';

export default function VoicemailImporter({
  onClose,
  onCreateTask,
  users,
}: VoicemailImporterProps) {
  // File and audio state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // Parsed task state
  const [mainTask, setMainTask] = useState({
    text: '',
    priority: 'medium' as TodoPriority,
    dueDate: '',
    assignedTo: '',
  });
  const [subtasks, setSubtasks] = useState<ParsedSubtask[]>([]);
  const [summary, setSummary] = useState('');

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i)) {
      setError('Please select an audio file (MP3, WAV, M4A, etc.)');
      return;
    }

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be under 25MB');
      return;
    }

    setSelectedFile(file);
    setError('');

    // Create audio URL for playback
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // Toggle audio playback
  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Process the voicemail - transcribe and parse for tasks
  const processVoicemail = async () => {
    if (!selectedFile) return;

    setStatus('transcribing');
    setError('');

    try {
      // First: Transcribe the audio
      const formData = new FormData();
      formData.append('audio', selectedFile);
      formData.append('users', JSON.stringify(users));

      const response = await fetch('/api/ai/transcribe', {
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

      const transcript = data.text || '';
      setTranscription(transcript);

      // Now parse the transcript with smart-parse to get main task + subtasks
      setStatus('parsing');

      const parseResponse = await fetch('/api/ai/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          users,
        }),
      });

      if (parseResponse.ok) {
        const parseData = await parseResponse.json();
        if (parseData.success && parseData.result) {
          const result = parseData.result;

          // Set main task
          setMainTask({
            text: result.mainTask.text || transcript.slice(0, 200),
            priority: result.mainTask.priority || 'medium',
            dueDate: result.mainTask.dueDate || '',
            assignedTo: result.mainTask.assignedTo || '',
          });

          // Set subtasks
          if (result.subtasks && result.subtasks.length > 0) {
            const parsedSubtasks: ParsedSubtask[] = result.subtasks.map((st: {
              text: string;
              priority: string;
              estimatedMinutes?: number;
            }) => ({
              text: st.text,
              priority: st.priority as TodoPriority,
              estimatedMinutes: st.estimatedMinutes,
              selected: true,
            }));
            setSubtasks(parsedSubtasks);
          }

          setSummary(result.summary || '');
        }
      } else {
        // Fallback: use transcription as task text if parsing fails
        setMainTask({
          text: transcript.slice(0, 200),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        });
      }

      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      setStatus('error');
    }
  };

  // Toggle subtask selection
  const toggleSubtask = (index: number) => {
    setSubtasks(prev => prev.map((st, i) =>
      i === index ? { ...st, selected: !st.selected } : st
    ));
  };

  // Update subtask
  const updateSubtask = (index: number, updates: Partial<ParsedSubtask>) => {
    setSubtasks(prev => prev.map((st, i) =>
      i === index ? { ...st, ...updates } : st
    ));
  };

  // Remove subtask
  const removeSubtask = (index: number) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  // Add new subtask
  const addSubtask = () => {
    setSubtasks(prev => [...prev, {
      text: '',
      priority: 'medium',
      selected: true,
    }]);
  };

  // Create the task
  const handleCreate = () => {
    if (!mainTask.text.trim()) {
      setError('Please enter a task description');
      return;
    }

    const selectedSubtasks: Subtask[] = subtasks
      .filter(st => st.selected && st.text.trim())
      .map(st => ({
        id: uuidv4(),
        text: st.text.trim(),
        completed: false,
        priority: st.priority,
        estimatedMinutes: st.estimatedMinutes,
      }));

    onCreateTask(
      mainTask.text.trim(),
      mainTask.priority,
      mainTask.dueDate || undefined,
      mainTask.assignedTo || undefined,
      selectedSubtasks.length > 0 ? selectedSubtasks : undefined
    );

    onClose();
  };

  // Clear and start over
  const handleClear = () => {
    setSelectedFile(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setTranscription('');
    setMainTask({ text: '', priority: 'medium', dueDate: '', assignedTo: '' });
    setSubtasks([]);
    setSummary('');
    setStatus('idle');
    setError('');
  };

  const totalSelected = subtasks.filter(st => st.selected).length;
  const priorityConfig = PRIORITY_CONFIG[mainTask.priority];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <FileAudio className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Import Voicemail</h2>
              <p className="text-sm text-slate-500">Upload audio to create a task with subtasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Upload area - shown when no file selected */}
          {status === 'idle' && !selectedFile && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center
                       hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer"
            >
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="font-medium text-slate-700 text-lg">Drop your voicemail here</p>
              <p className="text-slate-500 mt-2">or click to browse</p>
              <p className="text-sm text-slate-400 mt-4">
                Supports MP3, WAV, M4A, OGG, WebM, FLAC (max 25MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File selected - show preview and process button */}
          {status === 'idle' && selectedFile && (
            <div className="space-y-4">
              {/* Audio player */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayback}
                    className="w-12 h-12 rounded-full bg-purple-500 hover:bg-purple-600
                             text-white flex items-center justify-center transition-colors"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    aria-label="Remove file"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                )}
              </div>

              {/* Process button */}
              <button
                onClick={processVoicemail}
                className="w-full py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl
                         font-medium transition-colors flex items-center justify-center gap-2 text-lg"
              >
                <Sparkles className="w-5 h-5" />
                Transcribe & Extract Tasks
              </button>
            </div>
          )}

          {/* Processing state */}
          {(status === 'uploading' || status === 'transcribing' || status === 'parsing') && (
            <div className="p-8 text-center">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
              <p className="font-medium text-slate-700 text-lg">
                {status === 'transcribing' ? 'Transcribing audio...' : 'Extracting tasks...'}
              </p>
              <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Error processing voicemail</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700
                         rounded-xl font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results view */}
          {status === 'ready' && (
            <div className="space-y-6">
              {/* Transcript section */}
              {transcription && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-600">Transcript</p>
                    <button
                      onClick={() => setShowFullTranscript(!showFullTranscript)}
                      className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      {showFullTranscript ? 'Show less' : 'Show more'}
                      {showFullTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className={`text-sm text-slate-600 italic ${showFullTranscript ? '' : 'line-clamp-3'}`}>
                    &ldquo;{transcription}&rdquo;
                  </p>
                </div>
              )}

              {/* Summary */}
              {summary && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-700">{summary}</p>
                </div>
              )}

              {/* Main task editor */}
              <div className="space-y-4">
                <h3 className="font-medium text-slate-800">Main Task</h3>

                {/* Task text */}
                <input
                  type="text"
                  value={mainTask.text}
                  onChange={(e) => setMainTask(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Task description..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800
                           focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                />

                {/* Task options */}
                <div className="flex flex-wrap gap-3">
                  {/* Priority */}
                  <div className="relative">
                    <select
                      value={mainTask.priority}
                      onChange={(e) => setMainTask(prev => ({ ...prev, priority: e.target.value as TodoPriority }))}
                      className="appearance-none pl-8 pr-8 py-2 rounded-lg text-sm font-medium cursor-pointer
                               focus:outline-none focus:ring-2 focus:ring-purple-200 border border-slate-200"
                      style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <Flag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                          style={{ color: priorityConfig.color }} />
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50" />
                  </div>

                  {/* Due date */}
                  <div className="relative">
                    <input
                      type="date"
                      value={mainTask.dueDate}
                      onChange={(e) => setMainTask(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="pl-8 pr-3 py-2 rounded-lg text-sm border border-slate-200
                               focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Assignee */}
                  <div className="relative">
                    <select
                      value={mainTask.assignedTo}
                      onChange={(e) => setMainTask(prev => ({ ...prev, assignedTo: e.target.value }))}
                      className="appearance-none pl-8 pr-8 py-2 rounded-lg text-sm border border-slate-200
                               focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50" />
                  </div>
                </div>
              </div>

              {/* Subtasks section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-800">
                    Subtasks {subtasks.length > 0 && <span className="text-slate-400">({totalSelected} selected)</span>}
                  </h3>
                  <button
                    onClick={addSubtask}
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add subtask
                  </button>
                </div>

                {subtasks.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No subtasks extracted. Click &ldquo;Add subtask&rdquo; to create one manually.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {subtasks.map((subtask, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border transition-colors ${
                          subtask.selected
                            ? 'border-purple-200 bg-purple-50/50'
                            : 'border-slate-200 bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSubtask(index)}
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              subtask.selected
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'border-slate-300'
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
                              placeholder="Subtask description..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                            />

                            {/* Options row */}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Flag className="w-3 h-3 text-slate-400" />
                                <select
                                  value={subtask.priority}
                                  onChange={(e) => updateSubtask(index, { priority: e.target.value as TodoPriority })}
                                  className="text-xs px-2 py-1 rounded border border-slate-200 bg-white
                                           focus:outline-none focus:ring-2 focus:ring-purple-200"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </div>

                              {subtask.estimatedMinutes && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  {subtask.estimatedMinutes}m
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={() => removeSubtask(index)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* General error display */}
          {error && status !== 'error' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'ready' && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
            <button
              onClick={handleClear}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Start over
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!mainTask.text.trim()}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200
                         text-white disabled:text-slate-400 rounded-lg font-medium transition-colors
                         disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Create Task
                {totalSelected > 0 && ` with ${totalSelected} Subtask${totalSelected !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
