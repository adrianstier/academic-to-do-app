'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE } from '@/types/todo';
import { fetchWithCsrf } from '@/lib/csrf';

interface AttachmentUploadProps {
  todoId: string;
  userName: string;
  onUploadComplete: (newAttachment: import('@/types/todo').Attachment) => void;
  onClose: () => void;
  currentAttachmentCount: number;
  maxAttachments: number;
}

export default function AttachmentUpload({
  todoId,
  userName,
  onUploadComplete,
  onClose,
  currentAttachmentCount,
  maxAttachments,
}: AttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = maxAttachments - currentAttachmentCount;

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!(file.type in ALLOWED_ATTACHMENT_TYPES)) {
      return `File type "${file.type || 'unknown'}" is not supported. Allowed types: PDF, Word, Excel, Images, Audio, Video`;
    }

    // Check file size
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB limit`;
    }

    return null;
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setProgress(0);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('todoId', todoId);
      formData.append('userName', userName);

      setProgress(30);

      const response = await fetchWithCsrf('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      setProgress(70);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setProgress(100);
      // Pass the new attachment back to parent for state update and activity logging
      onUploadComplete(result.attachment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [todoId, userName, validateFile, onUploadComplete, onClose]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (remainingSlots <= 0) {
      setError(`Maximum of ${maxAttachments} attachments reached`);
      return;
    }

    // Upload the first file only
    uploadFile(files[0]);
  }, [remainingSlots, maxAttachments, uploadFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const allowedExtensions = Object.values(ALLOWED_ATTACHMENT_TYPES)
    .map(t => `.${t.ext}`)
    .join(',');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Upload attachment">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Upload Attachment</h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Remaining slots info */}
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {remainingSlots} of {maxAttachments} attachment{remainingSlots !== 1 ? 's' : ''} available
          </p>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-[var(--radius-xl)] p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                : uploading
                  ? 'border-[var(--border)] bg-[var(--surface-2)] cursor-not-allowed'
                  : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleInputChange}
              accept={allowedExtensions}
              disabled={uploading}
              className="hidden"
            />

            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 mx-auto text-[var(--accent)] animate-spin" />
                <p className="text-sm font-medium text-[var(--foreground)]">Uploading...</p>
                <div className="w-full h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                  {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  PDF, Documents, Images, Audio, Video (max {MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB)
                </p>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-[var(--radius-lg)] bg-[var(--danger-light)] border border-[var(--danger)]/20">
              <AlertCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          )}

          {/* Supported file types */}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Supported file types:</p>
            <div className="flex flex-wrap gap-1.5">
              {['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'TXT', 'CSV', 'JPG', 'PNG', 'GIF', 'MP3', 'WAV', 'MP4', 'ZIP'].map((ext) => (
                <span
                  key={ext}
                  className="px-2 py-0.5 text-xs rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
