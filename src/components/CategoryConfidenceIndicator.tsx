'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Check,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { TaskPatternMatch } from '@/lib/academicPatterns';
import { CATEGORY_COMPLETION_RATES } from '@/lib/academicPatterns';

interface CategoryConfidenceIndicatorProps {
  patternMatch: TaskPatternMatch | null;
  onDismiss: () => void;
  onAcceptSuggestions: () => void;
}

/**
 * Get confidence level display properties
 * | Score Range | Level | Color |
 * |-------------|-------|-------|
 * | >= 0.7      | High  | Green |
 * | >= 0.4      | Medium| Amber |
 * | < 0.4       | Low   | Gray  |
 */
function getConfidenceLevel(confidence: number): {
  level: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (confidence >= 0.7) {
    return {
      level: 'High',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
    };
  } else if (confidence >= 0.4) {
    return {
      level: 'Medium',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
    };
  }
  return {
    level: 'Low',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
  };
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * CategoryConfidenceIndicator Component
 *
 * Displays AI-detected task category with confidence level and actionable suggestions.
 * Shows when user types more than 10 characters and a pattern match is detected.
 */
export function CategoryConfidenceIndicator({
  patternMatch,
  onDismiss,
  onAcceptSuggestions,
}: CategoryConfidenceIndicatorProps) {
  const confidenceLevel = patternMatch ? getConfidenceLevel(patternMatch.confidence) : null;
  const completionRate = patternMatch ? CATEGORY_COMPLETION_RATES[patternMatch.category] : 0;
  const hasLowCompletion = completionRate < 60;
  const hasSubtasks = patternMatch ? patternMatch.suggestedSubtasks.length > 0 : false;

  return (
    <AnimatePresence>
      {patternMatch && confidenceLevel && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          role="region"
          aria-label="AI task analysis"
        >
          <div
            className={`p-3 rounded-lg border mb-3 ${confidenceLevel.bgColor} ${confidenceLevel.borderColor}`}
          >
            {/* Header with category and confidence */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${confidenceLevel.color}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Detected: <span className={confidenceLevel.color}>{formatCategoryName(patternMatch.category)}</span>
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceLevel.bgColor} ${confidenceLevel.color} border ${confidenceLevel.borderColor}`}>
                  {confidenceLevel.level} confidence
                </span>
              </div>
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Dismiss suggestion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Completion rate warning for low-performing categories */}
            {hasLowCompletion && (
              <div className="mt-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">
                  This task type has a {completionRate}% completion rate. Subtasks can help!
                </span>
              </div>
            )}

            {/* Tips if available */}
            {patternMatch.tips && (
              <div className="mt-2 flex items-start gap-2 text-gray-600 dark:text-gray-300">
                <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="text-xs">{patternMatch.tips}</span>
              </div>
            )}

            {/* Suggestions section */}
            <div className="mt-3 space-y-2">
              {/* Priority suggestion */}
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span>
                  Suggested priority:{' '}
                  <span className="font-medium capitalize">{patternMatch.suggestedPriority}</span>
                </span>
              </div>

              {/* Subtasks preview */}
              {hasSubtasks && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <ChevronRight className="w-3 h-3" />
                    <span>Suggested subtasks ({patternMatch.suggestedSubtasks.length})</span>
                  </div>
                  <ul className="pl-4 space-y-0.5">
                    {patternMatch.suggestedSubtasks.slice(0, 3).map((subtask, index) => (
                      <li
                        key={index}
                        className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"
                      >
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        <span className="truncate">{subtask}</span>
                        {patternMatch.estimatedMinutes[index] && (
                          <span className="text-gray-400 ml-auto flex-shrink-0">
                            ~{patternMatch.estimatedMinutes[index]}m
                          </span>
                        )}
                      </li>
                    ))}
                    {patternMatch.suggestedSubtasks.length > 3 && (
                      <li className="text-xs text-gray-400 italic">
                        +{patternMatch.suggestedSubtasks.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={onAcceptSuggestions}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Check className="w-3 h-3" />
                Apply Suggestions
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
              >
                Ignore
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CategoryConfidenceIndicator;
