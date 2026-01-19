'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  X,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  Phone,
  Car,
  CreditCard,
  FileText,
  AlertCircle,
  DollarSign,
  UserPlus,
  FileX,
  Send,
} from 'lucide-react';
import { QuickTaskTemplate, TaskPattern, INSURANCE_QUICK_TASKS, TaskCategory } from '@/types/todo';
import { CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';
import { fetchWithCsrf } from '@/lib/csrf';

interface QuickTaskButtonsProps {
  onSelectTemplate: (template: QuickTaskTemplate) => void;
  patterns?: TaskPattern[];
  collapsed?: boolean;
  /** When true, renders in a compact inline mode without header/collapse controls */
  inline?: boolean;
}

/**
 * Category icon mapping using Lucide icons
 */
const CATEGORY_ICONS: Record<TaskCategory, React.ElementType> = {
  policy_review: ClipboardList,
  follow_up: Phone,
  vehicle_add: Car,
  payment: CreditCard,
  endorsement: FileText,
  documentation: Send,
  claim: AlertCircle,
  quote: DollarSign,
  cancellation: FileX,
  new_client: UserPlus,
  other: FileText,
};

/**
 * Category color mapping using CSS variables
 */
const CATEGORY_COLORS: Record<TaskCategory, { icon: string; bg: string }> = {
  policy_review: { icon: 'var(--accent)', bg: 'var(--accent-light)' },
  follow_up: { icon: '#E87722', bg: 'rgba(232, 119, 34, 0.12)' },
  vehicle_add: { icon: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  payment: { icon: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
  endorsement: { icon: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
  documentation: { icon: 'var(--accent)', bg: 'var(--accent-light)' },
  claim: { icon: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  quote: { icon: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' },
  cancellation: { icon: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  new_client: { icon: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
  other: { icon: 'var(--text-muted)', bg: 'var(--surface-2)' },
};

/**
 * Short, readable labels for each category
 */
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  policy_review: 'Policy Review',
  follow_up: 'Follow Up Call',
  vehicle_add: 'Add Vehicle',
  payment: 'Payment Issue',
  endorsement: 'Endorsement',
  documentation: 'Send Documents',
  claim: 'Process Claim',
  quote: 'Quote Request',
  cancellation: 'Cancellation',
  new_client: 'New Client',
  other: 'Other',
};

/**
 * Get completion indicator type for a category
 * Returns 'high' for >=90%, 'low' for <60%, null for middle range
 */
function getCompletionIndicator(category: TaskCategory): 'high' | 'low' | null {
  const rate = CATEGORY_COMPLETION_RATES[category];
  if (rate >= 90) return 'high';
  if (rate < 60) return 'low';
  return null;
}

/**
 * Check if a category is quote-related with low completion
 */
function isLowCompletionQuote(category: TaskCategory): boolean {
  return category === 'quote' && CATEGORY_COMPLETION_RATES.quote < 60;
}

export function QuickTaskButtons({
  onSelectTemplate,
  patterns = [],
  collapsed: initialCollapsed = false,
  inline = false,
}: QuickTaskButtonsProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [showQuoteWarning, setShowQuoteWarning] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<QuickTaskTemplate | null>(null);

  // Handle template selection with quote warning
  const handleTemplateSelect = useCallback((template: QuickTaskTemplate) => {
    if (isLowCompletionQuote(template.category)) {
      setPendingTemplate(template);
      setShowQuoteWarning(true);
    } else {
      onSelectTemplate(template);
    }
  }, [onSelectTemplate]);

  // Confirm quote selection after warning
  const confirmQuoteSelection = useCallback(() => {
    if (pendingTemplate) {
      onSelectTemplate(pendingTemplate);
    }
    setShowQuoteWarning(false);
    setPendingTemplate(null);
  }, [pendingTemplate, onSelectTemplate]);

  // Dismiss quote warning
  const dismissQuoteWarning = useCallback(() => {
    setShowQuoteWarning(false);
    setPendingTemplate(null);
  }, []);

  // Combine hardcoded insurance tasks with learned patterns
  const allTemplates: QuickTaskTemplate[] = [
    ...INSURANCE_QUICK_TASKS,
    ...patterns
      .filter(p => p.occurrence_count >= 3)
      .map(p => ({
        text: p.pattern_text,
        category: p.category,
        defaultPriority: p.avg_priority,
        suggestedSubtasks: p.common_subtasks,
      })),
  ];

  if (allTemplates.length === 0) {
    return null;
  }

  // Render the template grid (shared between inline and normal mode)
  const renderTemplateGrid = () => (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${inline ? 'gap-2' : 'gap-2.5 sm:gap-2'}`}>
      {allTemplates.map((template, index) => {
        const Icon = CATEGORY_ICONS[template.category] || FileText;
        const colors = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.other;
        const indicator = getCompletionIndicator(template.category);
        const rate = CATEGORY_COMPLETION_RATES[template.category];
        const label = CATEGORY_LABELS[template.category] || template.category;

        return (
          <button
            key={`${template.category}-${index}`}
            type="button"
            onClick={() => handleTemplateSelect(template)}
            className={`group relative flex items-center gap-2 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-[var(--border-hover)] active:scale-[0.98] transition-all text-left touch-manipulation ${
              inline ? 'py-2 min-h-[40px]' : 'py-3 sm:py-2.5 min-h-[52px] sm:min-h-[44px]'
            }`}
            title={`${label} - ${rate}% completion rate`}
            aria-label={`Create ${label} task`}
          >
            {/* Completion Indicator - top left for natural scan pattern */}
            {indicator && (
              <span
                className={`
                  absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full
                  ${indicator === 'high' ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}
                `}
                aria-label={indicator === 'high' ? 'High completion rate' : 'Low completion rate'}
              />
            )}

            {/* Icon */}
            <span
              className={`flex-shrink-0 rounded-md flex items-center justify-center transition-transform group-hover:scale-105 ${
                inline ? 'w-7 h-7' : 'w-9 h-9 sm:w-8 sm:h-8 rounded-lg'
              }`}
              style={{ backgroundColor: colors.bg }}
            >
              <Icon
                className={inline ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5 sm:w-4 sm:h-4'}
                style={{ color: colors.icon }}
              />
            </span>

            {/* Label */}
            <span className="flex-1 min-w-0">
              <span className={`block font-medium text-[var(--foreground)] truncate ${
                inline ? 'text-xs' : 'text-sm'
              }`}>
                {label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  // Inline mode: just render the grid with a subtle header
  if (inline) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-light)]">
            Quick Add
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>

        {/* Quote Warning Toast (inline) */}
        <AnimatePresence>
          {showQuoteWarning && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-2 p-2 bg-[var(--warning-light)] border border-[var(--warning)]/30 rounded-lg"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    Quote tasks have a 50% completion rate
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={confirmQuoteSelection}
                      className="px-2 py-1 text-xs font-medium bg-[var(--warning)] text-white rounded hover:brightness-110 transition-all"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={dismissQuoteWarning}
                      className="px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissQuoteWarning}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  aria-label="Dismiss warning"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {renderTemplateGrid()}
      </div>
    );
  }

  // Normal mode: collapsible with header
  return (
    <div className="mb-4">
      {/* Compact Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-medium text-[var(--text-light)] hover:text-[var(--text-muted)] transition-colors group min-h-[36px] touch-manipulation"
        aria-expanded={!isCollapsed}
        aria-controls="quick-add-templates"
      >
        <span className="flex items-center gap-1.5">
          <span className="uppercase tracking-wide">Quick Add</span>
          {isCollapsed && (
            <span className="text-[var(--text-light)] opacity-60">
              ({allTemplates.length})
            </span>
          )}
        </span>
        {isCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-light)] group-hover:text-[var(--text-muted)] transition-colors" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--text-light)] group-hover:text-[var(--text-muted)] transition-colors" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            id="quick-add-templates"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {/* Quote Warning Toast */}
            <AnimatePresence>
              {showQuoteWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-3 p-3 bg-[var(--warning-light)] border border-[var(--warning)]/30 rounded-xl"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        Quote tasks have a 50% completion rate
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Subtasks will be added to help break this into smaller steps.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={confirmQuoteSelection}
                          className="px-3 py-1.5 text-xs font-medium bg-[var(--warning)] text-white rounded-lg hover:brightness-110 transition-all min-h-[32px]"
                        >
                          Continue
                        </button>
                        <button
                          type="button"
                          onClick={dismissQuoteWarning}
                          className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors min-h-[32px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={dismissQuoteWarning}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
                      aria-label="Dismiss warning"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {renderTemplateGrid()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook to fetch task patterns from the API
 */
export function useTaskPatterns(): { patterns: TaskPattern[]; loading: boolean } {
  const [patterns, setPatterns] = useState<TaskPattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPatterns() {
      try {
        const response = await fetchWithCsrf('/api/patterns/suggestions');
        if (response.ok) {
          const data = await response.json();
          // Flatten grouped patterns
          const allPatterns = Object.values(data.patterns || {}).flat() as TaskPattern[];
          setPatterns(allPatterns);
        }
      } catch (error) {
        console.error('Failed to fetch task patterns:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPatterns();
  }, []);

  return { patterns, loading };
}
