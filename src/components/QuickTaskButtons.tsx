'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  ClipboardList,
  Car,
  UserPlus,
  AlertTriangle,
  CreditCard,
  DollarSign,
  FileText,
  Phone,
  Pin,
  LucideIcon,
  X
} from 'lucide-react';
import { QuickTaskTemplate, TaskPattern, INSURANCE_QUICK_TASKS, TaskCategory } from '@/types/todo';
import { CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';

interface QuickTaskButtonsProps {
  onSelectTemplate: (template: QuickTaskTemplate) => void;
  patterns?: TaskPattern[];
  collapsed?: boolean;
}

// Map categories to Lucide icons with colors
// Based on task analysis data: ordered by frequency
const CATEGORY_ICON_CONFIG: Record<TaskCategory, { icon: LucideIcon; color: string; bgColor: string }> = {
  // Top categories by frequency
  policy_review: { icon: ClipboardList, color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' }, // 42%
  follow_up: { icon: Phone, color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.15)' }, // 40%
  vehicle_add: { icon: Car, color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' }, // 25%
  payment: { icon: CreditCard, color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)' }, // 18% - 100% completion!
  endorsement: { icon: FileText, color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.15)' }, // 18%
  documentation: { icon: FileText, color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.15)' }, // 12%
  claim: { icon: AlertTriangle, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' }, // 10.5%
  quote: { icon: DollarSign, color: '#06B6D4', bgColor: 'rgba(6, 182, 212, 0.15)' }, // 10.5% - 50% completion
  cancellation: { icon: AlertTriangle, color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' }, // 6.6%
  new_client: { icon: UserPlus, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' }, // 2.6% - 100% completion!
  other: { icon: Pin, color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
};

/**
 * Get completion rate badge for a category
 * Returns emoji badge based on historical completion rate:
 * - 💯 for >=90% (excellent performance)
 * - ⚠️ for <60% (needs improvement)
 * - null for middle range (no badge)
 */
function getCompletionBadge(category: TaskCategory): { badge: string; tooltip: string } | null {
  const rate = CATEGORY_COMPLETION_RATES[category];
  if (rate >= 90) {
    return { badge: '💯', tooltip: `${rate}% completion rate` };
  } else if (rate < 60) {
    return { badge: '⚠️', tooltip: `Only ${rate}% completion rate - break into smaller steps` };
  }
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
}: QuickTaskButtonsProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [showAll, setShowAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showQuoteWarning, setShowQuoteWarning] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<QuickTaskTemplate | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      .filter(p => p.occurrence_count >= 3) // Only show frequent patterns
      .map(p => ({
        text: p.pattern_text,
        category: p.category,
        defaultPriority: p.avg_priority,
        suggestedSubtasks: p.common_subtasks,
      })),
  ];

  // Responsive default: 6 on desktop, 4 on mobile
  const defaultVisible = isMobile ? 4 : 6;
  const visibleTemplates = showAll ? allTemplates : allTemplates.slice(0, defaultVisible);

  if (allTemplates.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Header with collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-2 group"
      >
        <Sparkles className="w-4 h-4" />
        <span className="font-medium">Quick Add</span>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
        ) : (
          <ChevronUp className="w-4 h-4 opacity-50 group-hover:opacity-100" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Quote Warning Toast */}
            <AnimatePresence>
              {showQuoteWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Quote tasks have a 50% completion rate
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Consider breaking this into smaller steps for better follow-through.
                        All suggested subtasks will be added automatically.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={confirmQuoteSelection}
                          className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                        >
                          Continue Anyway
                        </button>
                        <button
                          onClick={dismissQuoteWarning}
                          className="px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={dismissQuoteWarning}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Button grid - responsive: 2 cols on mobile, 3 cols on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visibleTemplates.map((template, index) => {
                const iconConfig = CATEGORY_ICON_CONFIG[template.category] ?? CATEGORY_ICON_CONFIG.other;
                const IconComponent = iconConfig.icon;
                const completionBadge = getCompletionBadge(template.category);

                return (
                  <motion.button
                    key={`${template.category}-${index}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleTemplateSelect(template)}
                    className="flex items-center gap-3 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl hover:bg-[var(--surface-3)] hover:border-[var(--border-hover)] transition-all text-left group relative"
                    title={completionBadge?.tooltip}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: iconConfig.bgColor }}
                    >
                      <IconComponent
                        className="w-4 h-4"
                        style={{ color: iconConfig.color }}
                      />
                    </div>
                    <span className="text-sm text-[var(--foreground)] font-medium truncate flex-1">
                      {formatTemplateText(template.text)}
                    </span>
                    {/* Completion rate badge */}
                    {completionBadge && (
                      <span className="text-xs flex-shrink-0" title={completionBadge.tooltip}>
                        {completionBadge.badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Show more/less toggle */}
            {allTemplates.length > defaultVisible && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-2 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {showAll ? `Show less` : `Show ${allTemplates.length - defaultVisible} more`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Formats template text for display, removing placeholder brackets
 */
function formatTemplateText(text: string): string {
  // Replace [customer] and similar placeholders with ellipsis
  return text.replace(/\[[\w\s]+\]/g, '...').trim();
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
        const response = await fetch('/api/patterns/suggestions');
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
