'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  FileText,
  Paperclip,
  MessageSquare,
  Code,
  FileJson,
  Table,
  AlertCircle,
} from 'lucide-react';
import { Todo } from '@/types/todo';
import {
  generateSummary,
  copyToClipboard,
  SummaryFormat,
  getPreferredFormat,
  setPreferredFormat,
} from '@/lib/summaryGenerator';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useKeyboardShortcuts, getModifierSymbol } from '@/hooks/useKeyboardShortcuts';

interface TaskCompletionSummaryProps {
  todo: Todo;
  completedBy: string;
  onClose: () => void;
}

// Format options with icons and labels
const FORMAT_OPTIONS: { value: SummaryFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Plain Text', icon: <FileText className="w-4 h-4" aria-hidden="true" /> },
  { value: 'markdown', label: 'Markdown', icon: <Code className="w-4 h-4" aria-hidden="true" /> },
  { value: 'json', label: 'JSON', icon: <FileJson className="w-4 h-4" aria-hidden="true" /> },
  { value: 'csv', label: 'CSV', icon: <Table className="w-4 h-4" aria-hidden="true" /> },
];

// Copy button states
type CopyState = 'idle' | 'success' | 'error';

// Error auto-clear timeout (4 seconds)
const ERROR_CLEAR_TIMEOUT = 4000;
// Success auto-clear timeout (2 seconds)
const SUCCESS_CLEAR_TIMEOUT = 2000;

export function TaskCompletionSummary({
  todo,
  completedBy,
  onClose,
}: TaskCompletionSummaryProps) {
  // Initialize format from persisted preference
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(() => getPreferredFormat());
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [showPreview, setShowPreview] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Ref to track timeout for cleanup on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus trap for modal accessibility
  const { containerRef } = useFocusTrap<HTMLDivElement>({
    onEscape: onClose,
    autoFocus: true,
    primaryActionSelector: '[data-primary-action]',
  });

  // Generate summary text (memoized for performance)
  const summaryText = useMemo(
    () => generateSummary(todo, completedBy, selectedFormat),
    [todo, completedBy, selectedFormat]
  );

  // Handle format change with persistence
  const handleFormatChange = useCallback((format: SummaryFormat) => {
    setSelectedFormat(format);
    setPreferredFormat(format);
  }, []);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      const success = await copyToClipboard(summaryText);

      if (success) {
        setCopyState('success');
        const formatLabel = FORMAT_OPTIONS.find(f => f.value === selectedFormat)?.label || selectedFormat;
        setStatusMessage(`${formatLabel} summary copied to clipboard`);

        // Auto-clear success state
        timeoutRef.current = setTimeout(() => {
          setCopyState('idle');
          setStatusMessage(null);
          timeoutRef.current = null;
        }, SUCCESS_CLEAR_TIMEOUT);
      } else {
        throw new Error('Copy operation returned false');
      }
    } catch {
      setCopyState('error');
      setStatusMessage('Failed to copy to clipboard. Please try selecting and copying manually.');

      // Auto-clear error state
      timeoutRef.current = setTimeout(() => {
        setCopyState('idle');
        setStatusMessage(null);
        timeoutRef.current = null;
      }, ERROR_CLEAR_TIMEOUT);
    }
  }, [summaryText, selectedFormat]);

  // Register keyboard shortcuts
  useKeyboardShortcuts(
    [
      {
        key: 'c',
        ctrlKey: true,
        action: handleCopy,
        description: 'Copy summary to clipboard',
      },
    ],
    { enabled: true, allowInInputs: false }
  );

  // Prevent body scroll when modal is open and cleanup timeouts on unmount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      // Clean up any pending timeout to prevent memory leaks
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Calculate stats
  const subtasksCompleted = todo.subtasks?.filter(s => s.completed).length || 0;
  const subtasksTotal = todo.subtasks?.length || 0;

  // Get copy button styles based on state
  const getCopyButtonStyles = () => {
    switch (copyState) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'error':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  // Get copy button content based on state
  const getCopyButtonContent = () => {
    switch (copyState) {
      case 'success':
        return (
          <>
            <Check className="w-4 h-4" aria-hidden="true" />
            Copied!
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            Try Again
          </>
        );
      default:
        return (
          <>
            <Copy className="w-4 h-4" aria-hidden="true" />
            Copy Summary
            <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-blue-700/50 rounded">
              {getModifierSymbol()}C
            </kbd>
          </>
        );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
        aria-hidden="true"
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-modal-title"
          aria-describedby="summary-modal-description"
        >
          {/* Live region for screen reader announcements */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {statusMessage}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="summary-modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Task Summary
                </h2>
                <p
                  id="summary-modal-description"
                  className="text-sm text-gray-500 dark:text-gray-400"
                >
                  Copy to paste into your database
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              aria-label="Close task summary modal"
            >
              <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
            {/* Quick Stats */}
            <div className="flex gap-4 mb-4">
              {subtasksTotal > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
                  <span>{subtasksCompleted}/{subtasksTotal} subtasks</span>
                </div>
              )}
              {todo.attachments && todo.attachments.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Paperclip className="w-4 h-4" aria-hidden="true" />
                  <span>{todo.attachments.length} attachments</span>
                </div>
              )}
              {todo.transcription && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  <span>Transcription</span>
                </div>
              )}
            </div>

            {/* Format Selector */}
            <fieldset className="mb-3">
              <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Export Format
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select export format">
                {FORMAT_OPTIONS.map((option) => {
                  const isSelected = selectedFormat === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleFormatChange(option.value)}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${option.label}${isSelected ? ' (selected)' : ''}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                      {isSelected && (
                        <Check className="w-3 h-3 ml-1" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Toggle Preview/Raw */}
            <div className="flex gap-2 mb-3" role="tablist" aria-label="View mode">
              <button
                onClick={() => setShowPreview(true)}
                role="tab"
                aria-selected={showPreview}
                aria-controls={showPreview ? 'summary-panel' : undefined}
                id="preview-tab"
                tabIndex={showPreview ? 0 : -1}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                  showPreview
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setShowPreview(false)}
                role="tab"
                aria-selected={!showPreview}
                aria-controls={!showPreview ? 'summary-panel' : undefined}
                id="raw-tab"
                tabIndex={!showPreview ? 0 : -1}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                  !showPreview
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Raw {selectedFormat.toUpperCase()}
              </button>
            </div>

            {/* Summary Content - single tabpanel that changes content */}
            {showPreview ? (
              <div
                id="summary-panel"
                role="tabpanel"
                aria-labelledby="preview-tab"
                className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {todo.text}
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Completed by {completedBy}</p>
                  <p>Priority: <span className="capitalize">{todo.priority}</span></p>
                  {todo.assigned_to && <p>Assigned to: {todo.assigned_to}</p>}
                </div>

                {subtasksTotal > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      SUBTASKS
                    </p>
                    <ul className="space-y-1">
                      {todo.subtasks?.map((subtask) => (
                        <li
                          key={subtask.id}
                          className={`text-sm flex items-center gap-2 ${
                            subtask.completed
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span
                            className={subtask.completed ? 'text-green-500' : 'text-gray-400'}
                            aria-hidden="true"
                          >
                            {subtask.completed ? '✓' : '○'}
                          </span>
                          <span className={subtask.completed ? 'line-through' : ''}>
                            {subtask.text}
                          </span>
                          <span className="sr-only">
                            {subtask.completed ? '(completed)' : '(incomplete)'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {todo.notes && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      NOTES
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {todo.notes}
                    </p>
                  </div>
                )}

                <div className="pt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                  Generated by Academic Project Manager
                </div>
              </div>
            ) : (
              <pre
                id="summary-panel"
                role="tabpanel"
                aria-labelledby="raw-tab"
                className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto"
              >
                {summaryText}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              data-primary-action
              disabled={copyState === 'success'}
              aria-describedby={statusMessage ? 'copy-status' : undefined}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${getCopyButtonStyles()} ${
                copyState === 'success' ? 'cursor-default' : ''
              }`}
            >
              {getCopyButtonContent()}
            </button>
          </div>

          {/* Hidden status for aria-describedby */}
          {statusMessage && (
            <span id="copy-status" className="sr-only">
              {statusMessage}
            </span>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
