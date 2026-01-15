'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { QuickTaskTemplate, TaskPattern, INSURANCE_QUICK_TASKS } from '@/types/todo';

interface QuickTaskButtonsProps {
  onSelectTemplate: (template: QuickTaskTemplate) => void;
  patterns?: TaskPattern[];
  collapsed?: boolean;
}

// Map categories to icons
const CATEGORY_ICONS: Record<string, string> = {
  policy_review: '📋',
  vehicle_add: '🚗',
  new_client: '👤',
  claim: '⚠️',
  payment: '💳',
  quote: '💰',
  documentation: '📄',
  follow_up: '📞',
  other: '📌',
};

export function QuickTaskButtons({
  onSelectTemplate,
  patterns = [],
  collapsed: initialCollapsed = false,
}: QuickTaskButtonsProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [showAll, setShowAll] = useState(false);

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
        icon: CATEGORY_ICONS[p.category] || '📌',
      })),
  ];

  // Show first 4 or all
  const visibleTemplates = showAll ? allTemplates : allTemplates.slice(0, 4);

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
            {/* Button grid */}
            <div className="grid grid-cols-2 gap-2">
              {visibleTemplates.map((template, index) => (
                <motion.button
                  key={`${template.category}-${index}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectTemplate(template)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all text-left group"
                >
                  <span className="text-lg flex-shrink-0">
                    {template.icon || CATEGORY_ICONS[template.category] || '📌'}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {formatTemplateText(template.text)}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Show more/less toggle */}
            {allTemplates.length > 4 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-2 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {showAll ? `Show less` : `Show ${allTemplates.length - 4} more`}
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
