'use client';

import { useState, useRef } from 'react';
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
  FileText
} from 'lucide-react';
import { Subtask, TodoPriority } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';

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

type ImportMode = 'email' | 'voicemail' | null;
type ProcessingStatus = 'idle' | 'transcribing' | 'parsing' | 'ready' | 'error';

export default function ContentToSubtasksImporter({
  onClose,
  onAddSubtasks,
  parentTaskText
}: ContentToSubtasksImporterProps) {
  const [mode, setMode] = useState<ImportMode>(null);
  const [emailContent, setEmailContent] = useState('');
  const [transcription, setTranscription] = useState('');
  const [subtasks, setSubtasks] = useState<ParsedSubtask[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmailParse = async () => {
    if (!emailContent.trim()) {
      setError('Please paste email content first');
      return;
    }

    setStatus('parsing');
    setError('');

    try {
      const response = await fetch('/api/ai/parse-content-to-subtasks', {
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

    setStatus('transcribing');
    setError('');

    try {
      // Step 1: Transcribe the audio
      const formData = new FormData();
      formData.append('audio', file);

      const transcribeResponse = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const transcribeData = await transcribeResponse.json();
      if (!transcribeData.success || !transcribeData.text) {
        throw new Error(transcribeData.error || 'No transcription returned');
      }

      setTranscription(transcribeData.text);
      setStatus('parsing');

      // Step 2: Parse the transcription into subtasks
      const parseResponse = await fetch('/api/ai/parse-content-to-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: transcribeData.text,
          contentType: 'voicemail',
          parentTaskText,
        }),
      });

      const parseData = await parseResponse.json();

      if (!parseData.success) {
        throw new Error(parseData.error || 'Failed to parse voicemail');
      }

      const parsedSubtasks: ParsedSubtask[] = parseData.subtasks.map((st: {
        text: string;
        priority: string;
        estimatedMinutes?: number;
      }) => ({
        ...st,
        priority: st.priority as TodoPriority,
        selected: true,
      }));

      setSubtasks(parsedSubtasks);
      setSummary(parseData.summary || '');
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
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Import as Subtasks</h2>
              <p className="text-sm text-slate-500">Extract action items from emails or voicemails</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Parent task context */}
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Adding subtasks to:</p>
            <p className="text-sm font-medium text-slate-700 truncate">{parentTaskText}</p>
          </div>

          {/* Mode selection */}
          {!mode && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('email')}
                className="p-6 border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
              >
                <Mail className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 mx-auto mb-3 transition-colors" />
                <p className="font-medium text-slate-700 group-hover:text-indigo-700">Paste Email</p>
                <p className="text-sm text-slate-500 mt-1">Paste email or message text</p>
              </button>
              <button
                onClick={() => setMode('voicemail')}
                className="p-6 border-2 border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
              >
                <FileAudio className="w-10 h-10 text-slate-400 group-hover:text-purple-500 mx-auto mb-3 transition-colors" />
                <p className="font-medium text-slate-700 group-hover:text-purple-700">Upload Audio</p>
                <p className="text-sm text-slate-500 mt-1">Upload voicemail or recording</p>
              </button>
            </div>
          )}

          {/* Email input mode */}
          {mode === 'email' && status !== 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={resetToModeSelection}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  &larr; Back
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Paste email or message content
                </label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  placeholder="Paste the full email or message here..."
                  className="w-full h-48 px-4 py-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm"
                  disabled={status === 'parsing'}
                />
                <p className="text-xs text-slate-400 mt-1">
                  {emailContent.length} characters
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleEmailParse}
                disabled={!emailContent.trim() || status === 'parsing'}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
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
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  &larr; Back
                </button>
              </div>

              {status === 'idle' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-colors cursor-pointer"
                >
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="font-medium text-slate-600">Click to upload audio file</p>
                  <p className="text-sm text-slate-400 mt-1">MP3, WAV, M4A, OGG (max 25MB)</p>
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
                <div className="p-6 bg-slate-50 rounded-xl text-center">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                  <p className="font-medium text-slate-700">
                    {status === 'transcribing' ? 'Transcribing audio...' : 'Extracting action items...'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">This may take a moment</p>
                </div>
              )}

              {transcription && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Transcription:</p>
                  <p className="text-sm text-slate-600 italic line-clamp-3">&ldquo;{transcription}&rdquo;</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  &larr; Start over
                </button>
                <span className="text-sm text-slate-500">
                  {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {summary && (
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-indigo-700">{summary}</p>
                </div>
              )}

              {/* Subtasks list */}
              <div className="space-y-2">
                {subtasks.map((subtask, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-colors ${
                      subtask.selected
                        ? 'border-indigo-200 bg-indigo-50/50'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSubtask(index)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          subtask.selected
                            ? 'bg-indigo-500 border-indigo-500 text-white'
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
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                        />

                        {/* Options row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Flag className="w-3 h-3 text-slate-400" />
                            <select
                              value={subtask.priority}
                              onChange={(e) => updateSubtask(index, { priority: e.target.value as TodoPriority })}
                              className="text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
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

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Empty state after processing */}
          {status === 'ready' && subtasks.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No action items found</p>
              <button
                onClick={resetToModeSelection}
                className="mt-2 text-indigo-500 hover:text-indigo-600 text-sm"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'ready' && subtasks.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
            <span className="text-sm text-slate-500">
              {totalSelected} subtask{totalSelected !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                disabled={totalSelected === 0}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
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
