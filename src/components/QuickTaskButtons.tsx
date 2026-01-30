'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  X,
  ChevronUp,
  ChevronDown,
  BookOpen,
  FileText,
  BarChart3,
  Send,
  Users,
  Presentation,
  PenTool,
  BookMarked,
  GraduationCap,
  ClipboardList,
  RotateCcw,
} from 'lucide-react';
import { QuickTaskTemplate, TaskPattern, ACADEMIC_QUICK_TASKS, TaskCategory } from '@/types/todo';
import { CATEGORY_COMPLETION_RATES } from '@/lib/academicPatterns';
import { fetchWithCsrf } from '@/lib/csrf';

interface QuickTaskButtonsProps {
  onSelectTemplate: (template: QuickTaskTemplate) => void;
  patterns?: TaskPattern[];
  collapsed?: boolean;
  /** When true, renders in a compact inline mode without header/collapse controls */
  inline?: boolean;
}

/**
 * Category icon mapping using Lucide icons for academic tasks
 */
const CATEGORY_ICONS: Record<TaskCategory, React.ElementType> = {
  research: BookOpen,
  meeting: Users,
  analysis: BarChart3,
  submission: Send,
  revision: RotateCcw,
  presentation: Presentation,
  writing: PenTool,
  reading: BookMarked,
  coursework: GraduationCap,
  admin: ClipboardList,
  other: FileText,
};

/**
 * Category color mapping using CSS variables for academic tasks
 */
const CATEGORY_COLORS: Record<TaskCategory, { icon: string; bg: string }> = {
  research: { icon: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },       // Purple - discovery
  meeting: { icon: '#0891B2', bg: 'rgba(8, 145, 178, 0.12)' },         // Cyan - collaboration
  analysis: { icon: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },        // Green - data
  submission: { icon: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },      // Red - urgent deadlines
  revision: { icon: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' },        // Amber - refinement
  presentation: { icon: '#E87722', bg: 'rgba(232, 119, 34, 0.12)' },   // Orange - performance
  writing: { icon: 'var(--accent)', bg: 'var(--accent-light)' },       // Brand blue - core work
  reading: { icon: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)' },        // Indigo - learning
  coursework: { icon: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },     // Pink - academic
  admin: { icon: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },         // Slate - administrative
  other: { icon: 'var(--text-muted)', bg: 'var(--surface-2)' },
};

/**
 * Short, readable labels for each academic category
 */
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  research: 'Research',
  meeting: 'Meeting',
  analysis: 'Analysis',
  submission: 'Submit',
  revision: 'Revision',
  presentation: 'Present',
  writing: 'Writing',
  reading: 'Reading',
  coursework: 'Coursework',
  admin: 'Admin',
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
 * Check if a category is writing-related with low completion
 * Writing tasks historically have lower completion rates and benefit from extra guidance
 */
function isLowCompletionWriting(category: TaskCategory): boolean {
  return category === 'writing' && CATEGORY_COMPLETION_RATES.writing < 70;
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

  // Handle template selection with writing warning
  const handleTemplateSelect = useCallback((template: QuickTaskTemplate) => {
    if (isLowCompletionWriting(template.category)) {
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

  // Combine hardcoded academic tasks with learned patterns
  const allTemplates: QuickTaskTemplate[] = [
    ...ACADEMIC_QUICK_TASKS,
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
    <div className={`flex flex-wrap ${inline ? 'gap-3' : 'gap-3'}`}>
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
            className={`group relative inline-flex items-center gap-2 rounded-full border bg-[var(--surface)] hover:bg-[var(--surface-2)] active:scale-[0.97] transition-all text-left touch-manipulation shadow-sm hover:shadow-md ${
              inline
                ? 'px-4 py-2.5 border-[var(--border)]'
                : 'px-4 py-2.5 border-[var(--border)] hover:border-[var(--border-hover)]'
            }`}
            style={{
              borderColor: indicator === 'high' ? colors.icon + '40' : undefined,
            }}
            title={`${label} - ${rate}% completion rate`}
            aria-label={`Create ${label} task`}
          >
            {/* Icon with colored background */}
            <span
              className={`flex-shrink-0 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                inline ? 'w-6 h-6' : 'w-6 h-6'
              }`}
              style={{ backgroundColor: colors.bg }}
            >
              <Icon
                className={inline ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'}
                style={{ color: colors.icon }}
              />
            </span>

            {/* Label */}
            <span className={`font-medium text-[var(--foreground)] whitespace-nowrap ${
              inline ? 'text-sm' : 'text-sm'
            }`}>
              {label}
            </span>

            {/* Completion Indicator dot - subtle, next to label */}
            {indicator && (
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  indicator === 'high' ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'
                }`}
                aria-label={indicator === 'high' ? 'High completion rate' : 'Low completion rate'}
              />
            )}
          </button>
        );
      })}
    </div>
  );

  // Inline mode: just render the grid with a subtle header
  if (inline) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-wider font-medium text-[var(--text-light)]">
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
                    Writing tasks have a 65% completion rate
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
                        Writing tasks have a 65% completion rate
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Subtasks will be added to help break this into manageable chunks.
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
