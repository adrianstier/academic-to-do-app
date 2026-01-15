# Data-Driven Task Improvements - Implementation Plan

## Tech Lead Prompt

> **Copy-paste this to the implementing engineer:**
>
> We need to implement data-driven improvements to the Quick Task Buttons and task creation flow based on analysis of 76+ real tasks. The key findings are:
>
> 1. **Reorder Quick Tasks** - Follow-up calls are 40% of tasks but hidden. Reorder to match usage frequency.
> 2. **Quote Task Warning** - Quote tasks have 50% completion rate. Add subtle warning + suggest subtask breakdown.
> 3. **Completion Rate Badges** - Show 💯 on high-completion categories, ⚠️ on low ones.
> 4. **AI Confidence Indicator** - When AI detects category, show confidence level and tips.
>
> All code is in this plan. Files to modify:
> - `src/types/todo.ts` - Reorder INSURANCE_QUICK_TASKS
> - `src/components/QuickTaskButtons.tsx` - Add badges and warnings
> - `src/components/AddTodo.tsx` - Add AI confidence display
> - `src/lib/insurancePatterns.ts` - Already has completion rates
>
> Success metrics: Quote completion 50% → 70%, reduce common task creation time.

---

## Overview

Based on analysis of 76+ real insurance agency tasks, we identified opportunities to improve task creation UX by leveraging actual usage patterns and completion rates.

### Key Data Points

| Category | Frequency | Completion Rate | Action Needed |
|----------|-----------|-----------------|---------------|
| Policy Review | 42% | 71.9% | Keep prominent |
| Follow-up | 40% | 73.3% | **Move to visible slots** |
| Vehicle Add | 25% | 84.2% | Keep prominent |
| Payment | 18% | 100% | Add success badge |
| Endorsement | 18% | 78.6% | Standard |
| Documentation | 12% | 66.7% | Standard |
| Claim | 10.5% | 87.5% | Standard |
| Quote | 10.5% | **50%** | **Add warning** |
| Cancellation | 6.6% | 80% | Standard |
| New Client | 2.6% | 100% | Add success badge |

---

## Phase 1: Reorder Quick Tasks (Priority: High)

### Problem
Follow-up tasks represent 40% of all tasks but are hidden in slot 5+.

### Solution
Reorder `INSURANCE_QUICK_TASKS` in `src/types/todo.ts` to match usage frequency.

### Code Change

```typescript
// src/types/todo.ts
// Replace the existing INSURANCE_QUICK_TASKS with this frequency-ordered version:

export const INSURANCE_QUICK_TASKS: QuickTaskTemplate[] = [
  // 1. Policy Review (42%) - Most common
  {
    text: 'Review policy for [customer]',
    category: 'policy_review',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Review current coverage limits',
      'Check for available discounts',
      'Verify contact information',
    ],
  },
  // 2. Follow-up Call (40%) - CRITICAL: Must be visible!
  {
    text: 'Follow up call with [customer]',
    category: 'follow_up',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Review account notes before call',
      'Make call or leave voicemail',
      'Document conversation',
    ],
  },
  // 3. Vehicle Change (25%)
  {
    text: 'Add/remove vehicle for [customer]',
    category: 'vehicle_add',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Collect VIN and vehicle info',
      'Verify registration',
      'Calculate premium change',
      'Process with carrier',
    ],
  },
  // 4. Payment Issue (18%) - 100% completion rate!
  {
    text: 'Resolve payment issue for [customer]',
    category: 'payment',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Review account payment status',
      'Contact carrier if needed',
      'Process payment or resolve issue',
    ],
  },
  // 5. Policy Endorsement (18%)
  {
    text: 'Process endorsement for [customer]',
    category: 'endorsement',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Review requested changes',
      'Calculate premium impact',
      'Submit to carrier',
    ],
  },
  // 6. New Quote (10.5%) - Low completion rate warning
  {
    text: 'Prepare quote for [customer]',
    category: 'quote',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Collect customer information',
      'Pull MVR and claims history',
      'Run quotes with multiple carriers',
      'Compare options and pricing',
      'Prepare proposal document',
      'Schedule follow-up call',
    ],
  },
  // 7. File Claim (10.5%)
  {
    text: 'File claim for [customer]',
    category: 'claim',
    defaultPriority: 'urgent',
    suggestedSubtasks: [
      'File claim with carrier',
      'Document incident details',
      'Coordinate with adjuster',
    ],
  },
  // 8. Send Documents (12%)
  {
    text: 'Send documents to [customer]',
    category: 'documentation',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Locate requested documents',
      'Verify accuracy',
      'Email to customer',
    ],
  },
  // 9. New Client Onboarding (2.6%) - 100% completion!
  {
    text: 'Onboard new client [customer]',
    category: 'new_client',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Gather customer information',
      'Run quotes with carriers',
      'Present options and bind',
      'Set up in system',
      'Send welcome packet',
    ],
  },
  // 10. Process Cancellation (6.6%)
  {
    text: 'Process cancellation for [customer]',
    category: 'cancellation',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Verify cancellation request',
      'Offer retention options',
      'Process with carrier',
    ],
  },
];
```

---

## Phase 2: Completion Rate Badges (Priority: Medium)

### Problem
Users don't know which task types they typically complete successfully.

### Solution
Add visual badges to Quick Task Buttons showing completion rate performance.

### Code Change

```tsx
// src/components/QuickTaskButtons.tsx

import { CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';

// Add this helper function after the imports
function getCompletionBadge(category: TaskCategory): { emoji: string; tooltip: string } | null {
  const rate = CATEGORY_COMPLETION_RATES[category];

  if (rate >= 90) {
    return {
      emoji: '💯',
      tooltip: `${rate}% completion rate - you crush these tasks!`,
    };
  }

  if (rate < 60) {
    return {
      emoji: '⚠️',
      tooltip: `${rate}% completion rate - consider breaking into smaller steps`,
    };
  }

  return null;
}

// In the component, update the button rendering (around line 100-127):
{visibleTemplates.map((template, index) => {
  const iconConfig = CATEGORY_ICON_CONFIG[template.category] ?? CATEGORY_ICON_CONFIG.other;
  const IconComponent = iconConfig.icon;
  const badge = getCompletionBadge(template.category);

  return (
    <motion.button
      key={`${template.category}-${index}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onSelectTemplate(template)}
      className="flex items-center gap-3 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl hover:bg-[var(--surface-3)] hover:border-[var(--border-hover)] transition-all text-left group relative"
      title={badge?.tooltip}
    >
      {/* Completion badge */}
      {badge && (
        <span
          className="absolute -top-1 -right-1 text-xs"
          role="img"
          aria-label={badge.tooltip}
        >
          {badge.emoji}
        </span>
      )}

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ backgroundColor: iconConfig.bgColor }}
      >
        <IconComponent
          className="w-4 h-4"
          style={{ color: iconConfig.color }}
        />
      </div>
      <span className="text-sm text-[var(--foreground)] font-medium truncate">
        {formatTemplateText(template.text)}
      </span>
    </motion.button>
  );
})}
```

---

## Phase 3: Quote Task Warning (Priority: High)

### Problem
Quote tasks have only 50% completion rate - the lowest of all categories.

### Solution
When a quote template is selected, show an informational toast with tips for success.

### Code Change

```tsx
// src/components/QuickTaskButtons.tsx

// Add state for showing quote warning
const [showQuoteWarning, setShowQuoteWarning] = useState(false);

// Update the onSelectTemplate handler
const handleTemplateSelect = (template: QuickTaskTemplate) => {
  // Show warning for low-completion categories
  if (template.category === 'quote') {
    setShowQuoteWarning(true);
    // Auto-dismiss after 5 seconds
    setTimeout(() => setShowQuoteWarning(false), 5000);
  }

  onSelectTemplate(template);
};

// Add warning toast component (render after the button grid)
<AnimatePresence>
  {showQuoteWarning && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span className="text-amber-600 dark:text-amber-400 text-lg" aria-hidden="true">
          💡
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Quote tasks can be complex
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            We've added 6 subtasks to help you stay on track. Consider setting a due date and breaking into multiple sessions if needed.
          </p>
        </div>
        <button
          onClick={() => setShowQuoteWarning(false)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## Phase 4: AI Confidence Indicator (Priority: Medium)

### Problem
When AI detects a task category, users don't know how confident the match is or get helpful tips.

### Solution
Show a subtle indicator with category detection info after smart parsing.

### New Component

```tsx
// src/components/CategoryConfidenceIndicator.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TaskCategory, PRIORITY_CONFIG } from '@/types/todo';
import { TaskPatternMatch, CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';
import { Info, CheckCircle, AlertCircle } from 'lucide-react';

interface CategoryConfidenceIndicatorProps {
  patternMatch: TaskPatternMatch | null;
  onDismiss: () => void;
  onAcceptSuggestions: () => void;
}

export function CategoryConfidenceIndicator({
  patternMatch,
  onDismiss,
  onAcceptSuggestions,
}: CategoryConfidenceIndicatorProps) {
  if (!patternMatch) return null;

  const { category, confidence, suggestedPriority, tips } = patternMatch;
  const completionRate = CATEGORY_COMPLETION_RATES[category];

  // Determine confidence level display
  const confidenceLevel = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';
  const confidenceColor = {
    high: 'text-green-600 dark:text-green-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-gray-500 dark:text-gray-400',
  }[confidenceLevel];

  const confidenceLabel = {
    high: 'High confidence',
    medium: 'Moderate confidence',
    low: 'Low confidence',
  }[confidenceLevel];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
        role="region"
        aria-label="AI task analysis"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {/* Category Detection */}
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Detected: {formatCategoryName(category)}
              </span>
              <span className={`text-xs ${confidenceColor}`}>
                ({confidenceLabel})
              </span>
            </div>

            {/* Suggested Priority */}
            <div className="flex items-center gap-4 text-xs text-blue-700 dark:text-blue-300 mb-2">
              <span>
                Suggested priority: <strong>{suggestedPriority}</strong>
              </span>
              <span>
                Typical completion: <strong>{completionRate}%</strong>
              </span>
            </div>

            {/* Tips if available */}
            {tips && (
              <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                💡 {tips}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <button
              onClick={onAcceptSuggestions}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Apply
            </button>
            <button
              onClick={onDismiss}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function formatCategoryName(category: TaskCategory): string {
  const names: Record<TaskCategory, string> = {
    policy_review: 'Policy Review',
    follow_up: 'Follow-up',
    vehicle_add: 'Vehicle Change',
    payment: 'Payment',
    endorsement: 'Endorsement',
    documentation: 'Documentation',
    claim: 'Claim',
    quote: 'Quote',
    cancellation: 'Cancellation',
    new_client: 'New Client',
    other: 'Other',
  };
  return names[category] || category;
}
```

### Integration in AddTodo.tsx

```tsx
// In AddTodo.tsx, after smart parsing completes:

import { analyzeTaskPattern, TaskPatternMatch } from '@/lib/insurancePatterns';
import { CategoryConfidenceIndicator } from './CategoryConfidenceIndicator';

// Add state
const [patternMatch, setPatternMatch] = useState<TaskPatternMatch | null>(null);

// After setting task text from smart parse or user input:
useEffect(() => {
  if (taskText.length > 10) {
    const match = analyzeTaskPattern(taskText);
    setPatternMatch(match);
  } else {
    setPatternMatch(null);
  }
}, [taskText]);

// Handler for accepting suggestions
const handleAcceptSuggestions = () => {
  if (patternMatch) {
    setPriority(patternMatch.suggestedPriority);
    // Optionally add suggested subtasks
    if (patternMatch.suggestedSubtasks.length > 0 && subtasks.length === 0) {
      setSubtasks(patternMatch.suggestedSubtasks.map((text, i) => ({
        id: `suggested-${i}`,
        text,
        completed: false,
        priority: 'medium',
      })));
    }
  }
  setPatternMatch(null);
};

// Render the indicator below the task input
<CategoryConfidenceIndicator
  patternMatch={patternMatch}
  onDismiss={() => setPatternMatch(null)}
  onAcceptSuggestions={handleAcceptSuggestions}
/>
```

---

## Phase 5: Show More Templates by Default (Priority: Low)

### Problem
Currently only 4 templates visible, hiding high-frequency options.

### Solution
Show 6 templates by default (2x3 grid on desktop, 2x2 on mobile).

### Code Change

```tsx
// src/components/QuickTaskButtons.tsx

// Change from:
const visibleTemplates = showAll ? allTemplates : allTemplates.slice(0, 4);

// To responsive version:
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 640);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

const defaultVisible = isMobile ? 4 : 6;
const visibleTemplates = showAll ? allTemplates : allTemplates.slice(0, defaultVisible);

// Update grid to be responsive:
<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
```

---

## Testing Checklist

### Functional Tests
- [ ] Quick tasks appear in new frequency order
- [ ] Follow-up Call is visible in default view
- [ ] Payment and New Client show 💯 badge
- [ ] Quote shows ⚠️ badge
- [ ] Selecting Quote template shows warning toast
- [ ] Toast auto-dismisses after 5 seconds
- [ ] Toast can be manually dismissed
- [ ] AI confidence indicator appears after typing 10+ characters
- [ ] "Apply" button sets priority and adds subtasks
- [ ] "Dismiss" hides the indicator
- [ ] 6 templates show on desktop, 4 on mobile

### Accessibility Tests
- [ ] Badges have aria-labels
- [ ] Warning toast has role="alert"
- [ ] Confidence indicator has role="region"
- [ ] All interactive elements are keyboard accessible
- [ ] Screen reader announces badge meanings

### Visual Tests
- [ ] Badges positioned correctly (top-right corner)
- [ ] Warning toast uses amber color scheme
- [ ] Confidence indicator uses blue color scheme
- [ ] Dark mode renders correctly
- [ ] Mobile layout looks good

---

## Success Metrics

Track these metrics after implementation:

1. **Quote Task Completion Rate**
   - Baseline: 50%
   - Target: 70%
   - Measurement: `SELECT category, COUNT(*) FILTER (WHERE completed) * 100.0 / COUNT(*) FROM todos WHERE category = 'quote' GROUP BY category`

2. **Quick Task Button Usage**
   - Track which templates are clicked most
   - Verify Follow-up is now in top 3 clicked

3. **Time to Create Common Tasks**
   - Measure time from opening AddTodo to task creation
   - Target: 20% reduction for policy review and follow-up tasks

4. **AI Suggestion Acceptance Rate**
   - Track how often users click "Apply" vs "Dismiss"
   - Target: >60% acceptance rate

---

## Implementation Order

1. **Day 1**: Phase 1 (Reorder Quick Tasks) - Quick win, high impact
2. **Day 1**: Phase 3 (Quote Warning) - Addresses biggest completion rate gap
3. **Day 2**: Phase 2 (Completion Badges) - Visual enhancement
4. **Day 2**: Phase 5 (6 Templates) - Simple change
5. **Day 3**: Phase 4 (AI Confidence) - Most complex, needs testing

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/types/todo.ts` | Reorder INSURANCE_QUICK_TASKS array |
| `src/components/QuickTaskButtons.tsx` | Add badges, warning toast, responsive grid |
| `src/components/CategoryConfidenceIndicator.tsx` | New component |
| `src/components/AddTodo.tsx` | Integrate CategoryConfidenceIndicator |

---

**Created**: 2026-01-15
**Author**: UX Engineering Team
**Status**: Ready for Implementation
