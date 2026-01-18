'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mail, Copy, Sparkles, Check,
  User, Phone, AtSign, FileText, ChevronDown, ChevronUp,
  RefreshCw, Send, AlertTriangle, Shield, Calendar, DollarSign, Info, Languages
} from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';
import { extractPhoneNumbers, extractEmails, extractPotentialNames } from '@/lib/duplicateDetection';
import { fetchWithCsrf } from '@/lib/csrf';
import { useEscapeKey } from '@/hooks';

interface CustomerEmailModalProps {
  todos: Todo[];
  currentUser: AuthUser;
  onClose: () => void;
  darkMode?: boolean;
}

type EmailTone = 'formal' | 'friendly' | 'brief';
type EmailLanguage = 'english' | 'spanish';

interface DetectedCustomer {
  name: string;
  email?: string;
  phone?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface EmailWarning {
  type: 'sensitive_info' | 'date_promise' | 'coverage_detail' | 'pricing' | 'negative_news' | 'needs_verification';
  message: string;
  location: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  suggestedFollowUp?: string;
  warnings?: EmailWarning[];
}

export default function CustomerEmailModal({
  todos,
  currentUser,
  onClose,
  darkMode = false,
}: CustomerEmailModalProps) {
  // Customer detection
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [detectedCustomer, setDetectedCustomer] = useState<DetectedCustomer | null>(null);

  // Email generation
  const [tone, setTone] = useState<EmailTone>('friendly');
  const [language, setLanguage] = useState<EmailLanguage>('english');
  const [includeNextSteps, setIncludeNextSteps] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  // UI state
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Handle Escape key to close modal
  useEscapeKey(onClose);

  // Detect customer from tasks on mount
  useEffect(() => {
    const allText = todos.map(t =>
      `${t.text} ${t.notes || ''} ${t.transcription || ''}`
    ).join(' ');

    const names = extractPotentialNames(allText);
    const emails = extractEmails(allText);
    const phones = extractPhoneNumbers(allText);

    const detected: DetectedCustomer = {
      name: names[0] || '',
      email: emails[0],
      phone: phones[0],
      confidence: phones.length > 0 || emails.length > 0 ? 'high' : names.length > 0 ? 'medium' : 'low',
    };

    setDetectedCustomer(detected);
    setCustomerName(detected.name);
    setCustomerEmail(detected.email || '');
    setCustomerPhone(detected.phone || '');
  }, [todos]);

  // Task summary for display
  const taskSummary = useMemo(() => {
    const completed = todos.filter(t => t.status === 'done' || t.completed).length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    const pending = todos.filter(t => t.status === 'todo' && !t.completed).length;
    return { completed, inProgress, pending, total: todos.length };
  }, [todos]);

  const generateEmail = async () => {
    if (!customerName.trim()) {
      setError('Please enter a customer name');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetchWithCsrf('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          tasks: todos.map(t => ({
            text: t.text,
            status: t.completed ? 'done' : t.status,
            subtasksCompleted: t.subtasks?.filter(s => s.completed).length || 0,
            subtasksTotal: t.subtasks?.length || 0,
            notes: t.notes,
            dueDate: t.due_date,
            transcription: t.transcription,
            attachments: t.attachments?.map(a => ({
              file_name: a.file_name,
              file_type: a.file_type,
            })),
            completed: t.completed,
          })),
          tone,
          language,
          senderName: currentUser.name,
          includeNextSteps,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate email');
      }

      setGeneratedEmail({
        subject: data.subject,
        body: data.body,
        suggestedFollowUp: data.suggestedFollowUp,
        warnings: data.warnings || [],
      });
      setEditedSubject(data.subject);
      setEditedBody(data.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setIsGenerating(false);
    }
  };

  const translateToSpanish = async () => {
    if (!generatedEmail) return;

    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetchWithCsrf('/api/ai/translate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editedSubject || generatedEmail.subject,
          body: editedBody || generatedEmail.body,
          targetLanguage: 'spanish',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to translate email');
      }

      setEditedSubject(data.subject);
      setEditedBody(data.body);
      setLanguage('spanish');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to translate email');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = async () => {
    const subject = isEditingSubject ? editedSubject : generatedEmail?.subject || '';
    const body = isEditingBody ? editedBody : generatedEmail?.body || '';
    const fullEmail = `Subject: ${subject}\n\n${body}`;

    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInMailClient = () => {
    const subject = isEditingSubject ? editedSubject : generatedEmail?.subject || '';
    const body = isEditingBody ? editedBody : generatedEmail?.body || '';
    const email = customerEmail.trim();

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const formatPhoneDisplay = (phone: string) => {
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    if (phone.length === 11 && phone.startsWith('1')) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
          darkMode ? 'bg-[#1a1f2e] text-white' : 'bg-white text-gray-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          darkMode ? 'border-white/10' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${darkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Generate Customer Email</h2>
              <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                Create an update email for {taskSummary.total} task{taskSummary.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-4 space-y-4">
          {/* Customer Info */}
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Customer Information
              </h3>
              {detectedCustomer && detectedCustomer.confidence !== 'low' && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  detectedCustomer.confidence === 'high'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  Auto-detected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    darkMode
                      ? 'bg-white/10 border-white/20 focus:border-blue-500'
                      : 'bg-white border-gray-200 focus:border-blue-500'
                  } border outline-none transition-colors`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  <AtSign className="w-3 h-3 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    darkMode
                      ? 'bg-white/10 border-white/20 focus:border-blue-500'
                      : 'bg-white border-gray-200 focus:border-blue-500'
                  } border outline-none transition-colors`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  <Phone className="w-3 h-3 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone ? formatPhoneDisplay(customerPhone) : ''}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="(555) 123-4567"
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    darkMode
                      ? 'bg-white/10 border-white/20 focus:border-blue-500'
                      : 'bg-white border-gray-200 focus:border-blue-500'
                  } border outline-none transition-colors`}
                />
              </div>
            </div>
          </div>

          {/* Task Summary */}
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <button
              onClick={() => setShowTaskDetails(!showTaskDetails)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Tasks to Include
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-2 text-xs">
                  {taskSummary.completed > 0 && (
                    <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                      {taskSummary.completed} done
                    </span>
                  )}
                  {taskSummary.inProgress > 0 && (
                    <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                      {taskSummary.inProgress} in progress
                    </span>
                  )}
                  {taskSummary.pending > 0 && (
                    <span className={`px-2 py-1 rounded-full ${
                      darkMode ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {taskSummary.pending} pending
                    </span>
                  )}
                </div>
                {showTaskDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            <AnimatePresence>
              {showTaskDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    {todos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`p-2 rounded-lg text-sm ${
                          darkMode ? 'bg-white/5' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            todo.completed || todo.status === 'done'
                              ? 'bg-green-500'
                              : todo.status === 'in_progress'
                              ? 'bg-yellow-500'
                              : 'bg-gray-400'
                          }`} />
                          <span className={todo.completed ? 'line-through opacity-60' : ''}>
                            {todo.text}
                          </span>
                        </div>
                        {todo.subtasks && todo.subtasks.length > 0 && (
                          <div className={`ml-4 mt-1 text-xs ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
                            {todo.subtasks.filter(s => s.completed).length}/{todo.subtasks.length} subtasks
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Email Options */}
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <h3 className="font-medium mb-3">Email Options</h3>

            <div className="space-y-3">
              {/* Tone Selection */}
              <div>
                <label className={`block text-xs mb-2 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  Tone
                </label>
                <div className="flex gap-2">
                  {(['friendly', 'formal', 'brief'] as EmailTone[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                        tone === t
                          ? 'bg-blue-500 text-white'
                          : darkMode
                          ? 'bg-white/10 hover:bg-white/20'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className={`block text-xs mb-2 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  Language
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('english')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      language === 'english'
                        ? 'bg-blue-500 text-white'
                        : darkMode
                        ? 'bg-white/10 hover:bg-white/20'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLanguage('spanish')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      language === 'spanish'
                        ? 'bg-blue-500 text-white'
                        : darkMode
                        ? 'bg-white/10 hover:bg-white/20'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Español
                  </button>
                </div>
              </div>

              {/* Include Next Steps */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNextSteps}
                  onChange={(e) => setIncludeNextSteps(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm">Include next steps / what to expect</span>
              </label>
            </div>
          </div>

          {/* Generate Button */}
          {!generatedEmail && (
            <button
              onClick={generateEmail}
              disabled={isGenerating || !customerName.trim()}
              className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                isGenerating || !customerName.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Email
                </>
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Generated Email Preview */}
          {generatedEmail && (
            <div className={`p-4 rounded-xl border-2 ${
              darkMode ? 'bg-white/5 border-blue-500/30' : 'bg-blue-50/50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  Generated Email
                  {language === 'spanish' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                      Español
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {language === 'english' && (
                    <button
                      onClick={translateToSpanish}
                      disabled={isTranslating}
                      className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                        darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-white hover:bg-gray-100'
                      }`}
                    >
                      <Languages className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} />
                      Translate to Spanish
                    </button>
                  )}
                  <button
                    onClick={generateEmail}
                    disabled={isGenerating}
                    className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                      darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Warnings */}
              {generatedEmail.warnings && generatedEmail.warnings.length > 0 && (
                <div className={`mb-3 p-3 rounded-lg border-2 ${
                  darkMode
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                        Review Before Sending
                      </h4>
                      <div className="space-y-2">
                        {generatedEmail.warnings.map((warning, i) => {
                          const getWarningIcon = (type: string) => {
                            switch (type) {
                              case 'sensitive_info': return Shield;
                              case 'date_promise': return Calendar;
                              case 'pricing': return DollarSign;
                              case 'coverage_detail': return FileText;
                              default: return Info;
                            }
                          };
                          const WarningIcon = getWarningIcon(warning.type);
                          return (
                            <div key={i} className={`flex items-start gap-2 text-xs ${
                              darkMode ? 'text-yellow-200' : 'text-yellow-800'
                            }`}>
                              <WarningIcon className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium">{warning.location}:</span>{' '}
                                {warning.message}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div className="mb-3">
                <label className={`block text-xs mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  Subject
                </label>
                {isEditingSubject ? (
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    onBlur={() => setIsEditingSubject(false)}
                    autoFocus
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${
                      darkMode
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white border-gray-200'
                    } border outline-none`}
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingSubject(true)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium cursor-text ${
                      darkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {editedSubject || generatedEmail.subject}
                  </div>
                )}
              </div>

              {/* Body */}
              <div>
                <label className={`block text-xs mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  Body (click to edit)
                </label>
                {isEditingBody ? (
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    onBlur={() => setIsEditingBody(false)}
                    autoFocus
                    rows={10}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white border-gray-200'
                    } border outline-none resize-none`}
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingBody(true)}
                    className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap cursor-text min-h-[150px] ${
                      darkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {editedBody || generatedEmail.body}
                  </div>
                )}
              </div>

              {/* Follow-up suggestion */}
              {generatedEmail.suggestedFollowUp && (
                <div className={`mt-3 text-xs ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
                  Suggested follow-up: {generatedEmail.suggestedFollowUp}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {generatedEmail && (
          <div className={`p-4 border-t ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : darkMode
                    ? 'bg-white/10 hover:bg-white/20'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </button>

              {customerEmail && (
                <button
                  onClick={openInMailClient}
                  className="flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white transition-all"
                >
                  <Send className="w-4 h-4" />
                  Open in Mail
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
