# Data-Driven Task Improvements - Technical Architecture

## Document Metadata

| Field | Value |
|-------|-------|
| **Document Type** | Technical Architecture Specification |
| **UX Plan Reference** | [DATA_DRIVEN_TASK_UX_PLAN.md](./DATA_DRIVEN_TASK_UX_PLAN.md) |
| **Author** | Tech Lead |
| **Created** | 2026-01-15 |
| **Status** | Ready for Implementation |
| **Estimated Effort** | 8-12 hours |
| **Risk Level** | Low |

---

## 1. Executive Summary

This document provides technical architecture for implementing data-driven improvements to the Quick Task Buttons and task creation flow. Based on analysis of 76+ real insurance agency tasks, these improvements will:

1. **Reorder Quick Tasks** by usage frequency (Follow-up at 40% moved to visible position)
2. **Add Completion Rate Badges** (💯 for high performers, ⚠️ for low)
3. **Show Quote Task Warnings** (50% completion rate needs intervention)
4. **Display AI Confidence Indicators** with actionable suggestions
5. **Show More Templates** by default (6 on desktop, 4 on mobile)

### Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Quote task completion rate | 50% | 70% |
| Follow-up visibility | Hidden (slot 5+) | Visible (slot 2) |
| AI suggestion acceptance | N/A | >60% |
| Time to create common tasks | Baseline | -20% |

---

## 2. System Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AddTodo.tsx                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        Task Input Field                            │ │
│  │  [___________________________________] [🎤] [✨]                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                  │                                      │
│                                  ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │              CategoryConfidenceIndicator (NEW)                     │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ ℹ️ Detected: Quote (High confidence)                        │ │ │
│  │  │ Suggested priority: medium | Completion rate: 50%           │ │ │
│  │  │ 💡 Break into smaller steps for better completion           │ │ │
│  │  │                                    [Apply] [Dismiss]        │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                  │                                      │
│                                  ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    QuickTaskButtons (MODIFIED)                     │ │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │ │
│  │  │ 📋 Policy Review │ │ 📞 Follow-up     │ │ 🚗 Vehicle Add   │ │ │
│  │  │                  │ │                  │ │            💯    │ │ │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘ │ │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │ │
│  │  │ 💳 Payment   💯  │ │ 📝 Endorsement   │ │ 💰 Quote     ⚠️  │ │ │
│  │  │                  │ │                  │ │                  │ │ │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ Quote Warning Toast (CONDITIONALLY SHOWN)                   │ │ │
│  │  │ 💡 Quote tasks can be complex - 6 subtasks added to help   │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Diagram

```
                                 User Input
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │     Text Analysis       │
                        │  (analyzeTaskPattern)   │
                        └───────────┬─────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              ┌──────────┐  ┌─────────────┐  ┌──────────────┐
              │ Category │  │ Confidence  │  │  Suggested   │
              │  Match   │  │   Score     │  │   Priority   │
              └────┬─────┘  └──────┬──────┘  └───────┬──────┘
                   │               │                 │
                   └───────────────┼─────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │  CategoryConfidenceIndicator │
                    │  ┌────────────────────────┐  │
                    │  │  TaskPatternMatch      │  │
                    │  │  - category            │  │
                    │  │  - confidence (0-1)    │  │
                    │  │  - suggestedPriority   │  │
                    │  │  - suggestedSubtasks   │  │
                    │  │  - tips                │  │
                    │  └────────────────────────┘  │
                    └───────────────┬──────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                 [Apply Button]           [Dismiss Button]
                        │                       │
                        ▼                       ▼
              ┌─────────────────┐    ┌─────────────────┐
              │ Update Priority │    │  Clear Pattern  │
              │ Add Subtasks    │    │     Match       │
              └─────────────────┘    └─────────────────┘
```

### 2.3 State Management Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           QuickTaskButtons State                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  State Variables:                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ isCollapsed: boolean        // Section visibility                  │ │
│  │ showAll: boolean            // Show all templates vs first N       │ │
│  │ showQuoteWarning: boolean   // Quote warning toast visibility      │ │
│  │ isMobile: boolean           // Responsive breakpoint               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Computed Values:                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ defaultVisible = isMobile ? 4 : 6                                  │ │
│  │ visibleTemplates = showAll ? all : all.slice(0, defaultVisible)    │ │
│  │ badge = getCompletionBadge(template.category)                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                             AddTodo State                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  New State Variable:                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ patternMatch: TaskPatternMatch | null  // AI detection result      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Effect Trigger:                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ useEffect(() => {                                                  │ │
│  │   if (text.length > 10) {                                         │ │
│  │     setPatternMatch(analyzeTaskPattern(text));                    │ │
│  │   } else {                                                        │ │
│  │     setPatternMatch(null);                                        │ │
│  │   }                                                                │ │
│  │ }, [text]);                                                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Modifications

### 3.1 Files to Modify

| File | Change Type | Complexity |
|------|-------------|------------|
| `src/types/todo.ts` | Reorder `INSURANCE_QUICK_TASKS` | Low |
| `src/components/QuickTaskButtons.tsx` | Add badges, warning toast, responsive grid | Medium |
| `src/components/AddTodo.tsx` | Integrate `CategoryConfidenceIndicator` | Medium |

### 3.2 New Files to Create

| File | Purpose | Complexity |
|------|---------|------------|
| `src/components/CategoryConfidenceIndicator.tsx` | AI confidence display component | Medium |

### 3.3 Existing Files (No Changes Required)

| File | Reason |
|------|--------|
| `src/lib/insurancePatterns.ts` | Already has `CATEGORY_COMPLETION_RATES`, `analyzeTaskPattern()`, `TaskPatternMatch` |

---

## 4. Implementation Details

### 4.1 Phase 1: Reorder Quick Tasks

**File:** `src/types/todo.ts`

**Change:** Reorder `INSURANCE_QUICK_TASKS` array by usage frequency.

**New Order (by frequency):**
1. Policy Review (42%)
2. Follow-up Call (40%) - **CRITICAL: Must be in default visible slots**
3. Vehicle Change (25%)
4. Payment (18%) - 100% completion rate
5. Endorsement (18%)
6. Quote (10.5%) - 50% completion rate, needs warning
7. Claim (10.5%)
8. Documentation (12%)
9. New Client (2.6%) - 100% completion rate
10. Cancellation (6.6%)

**Implementation Note:** The existing array order is close but Follow-up needs to move from position 2 to ensure it's always visible.

### 4.2 Phase 2: Completion Rate Badges

**File:** `src/components/QuickTaskButtons.tsx`

**New Helper Function:**
```typescript
import { CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';
import { TaskCategory } from '@/types/todo';

interface CompletionBadge {
  emoji: string;
  tooltip: string;
}

function getCompletionBadge(category: TaskCategory): CompletionBadge | null {
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
```

**Badge Positioning:**
- Absolute position: `-top-1 -right-1`
- Font size: `text-xs`
- Uses ARIA label for accessibility

**Categories with Badges:**
| Category | Completion Rate | Badge |
|----------|-----------------|-------|
| payment | 100% | 💯 |
| new_client | 100% | 💯 |
| quote | 50% | ⚠️ |
| other | 33.3% | ⚠️ |

### 4.3 Phase 3: Quote Warning Toast

**File:** `src/components/QuickTaskButtons.tsx`

**State Addition:**
```typescript
const [showQuoteWarning, setShowQuoteWarning] = useState(false);
```

**Handler Update:**
```typescript
const handleTemplateSelect = (template: QuickTaskTemplate) => {
  if (template.category === 'quote') {
    setShowQuoteWarning(true);
    setTimeout(() => setShowQuoteWarning(false), 5000);
  }
  onSelectTemplate(template);
};
```

**Toast UI Specifications:**
- Background: `bg-amber-50 dark:bg-amber-900/20`
- Border: `border-amber-200 dark:border-amber-800`
- Icon: 💡 (lightbulb)
- Auto-dismiss: 5 seconds
- Manual dismiss: X button
- ARIA: `role="alert"`

### 4.4 Phase 4: AI Confidence Indicator

**File:** `src/components/CategoryConfidenceIndicator.tsx` (NEW)

**Component Props:**
```typescript
interface CategoryConfidenceIndicatorProps {
  patternMatch: TaskPatternMatch | null;
  onDismiss: () => void;
  onAcceptSuggestions: () => void;
}
```

**Confidence Level Display:**
| Score Range | Level | Color |
|-------------|-------|-------|
| >= 0.7 | High | Green |
| >= 0.4 | Medium | Amber |
| < 0.4 | Low | Gray |

**UI Specifications:**
- Background: `bg-blue-50 dark:bg-blue-900/20`
- Border: `border-blue-200 dark:border-blue-800`
- ARIA: `role="region" aria-label="AI task analysis"`
- Animation: Framer Motion height transition

**Integration in AddTodo.tsx:**
```typescript
const [patternMatch, setPatternMatch] = useState<TaskPatternMatch | null>(null);

useEffect(() => {
  if (text.length > 10) {
    const match = analyzeTaskPattern(text);
    setPatternMatch(match);
  } else {
    setPatternMatch(null);
  }
}, [text]);

const handleAcceptSuggestions = () => {
  if (patternMatch) {
    setPriority(patternMatch.suggestedPriority);
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
```

### 4.5 Phase 5: Responsive Template Grid

**File:** `src/components/QuickTaskButtons.tsx`

**State Addition:**
```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 640);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

**Grid Configuration:**
| Screen Size | Visible by Default | Grid Columns |
|-------------|-------------------|--------------|
| Mobile (< 640px) | 4 | 2 |
| Desktop (>= 640px) | 6 | 3 |

**CSS Classes:**
```css
grid grid-cols-2 sm:grid-cols-3 gap-2
```

---

## 5. Type Definitions

### 5.1 Existing Types (No Changes)

From `src/lib/insurancePatterns.ts`:
```typescript
export interface TaskPatternMatch {
  category: TaskCategory;
  confidence: number;         // 0-1
  suggestedPriority: TodoPriority;
  suggestedSubtasks: string[];
  estimatedMinutes: number[];
  tips?: string;
}

export const CATEGORY_COMPLETION_RATES: Record<TaskCategory, number>;

export function analyzeTaskPattern(taskText: string): TaskPatternMatch | null;
```

From `src/types/todo.ts`:
```typescript
export type TaskCategory =
  | 'policy_review' | 'follow_up' | 'vehicle_add'
  | 'payment' | 'endorsement' | 'claim'
  | 'quote' | 'documentation' | 'new_client'
  | 'cancellation' | 'other';

export interface QuickTaskTemplate {
  text: string;
  category: TaskCategory;
  defaultPriority: TodoPriority;
  suggestedSubtasks: string[];
  icon?: string;
}
```

### 5.2 New Internal Types

```typescript
// QuickTaskButtons.tsx
interface CompletionBadge {
  emoji: string;
  tooltip: string;
}

// CategoryConfidenceIndicator.tsx
type ConfidenceLevel = 'high' | 'medium' | 'low';

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-gray-500 dark:text-gray-400',
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Moderate confidence',
  low: 'Low confidence',
};
```

---

## 6. Dependencies

### 6.1 Import Dependencies

**QuickTaskButtons.tsx additions:**
```typescript
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';
```

**AddTodo.tsx additions:**
```typescript
import { analyzeTaskPattern, TaskPatternMatch } from '@/lib/insurancePatterns';
import { CategoryConfidenceIndicator } from './CategoryConfidenceIndicator';
```

**CategoryConfidenceIndicator.tsx:**
```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle } from 'lucide-react';
import { TaskCategory, PRIORITY_CONFIG } from '@/types/todo';
import { TaskPatternMatch, CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';
```

### 6.2 External Dependencies (Already Installed)

- `framer-motion` - Animations
- `lucide-react` - Icons (Info, CheckCircle)

---

## 7. Testing Strategy

### 7.1 Unit Tests

**File:** `tests/data-driven-tasks.spec.ts`

```typescript
describe('Data-Driven Task Improvements', () => {
  describe('getCompletionBadge()', () => {
    test('returns 💯 for payment category (100% completion)', () => {
      const badge = getCompletionBadge('payment');
      expect(badge?.emoji).toBe('💯');
    });

    test('returns ⚠️ for quote category (50% completion)', () => {
      const badge = getCompletionBadge('quote');
      expect(badge?.emoji).toBe('⚠️');
    });

    test('returns null for medium completion rates', () => {
      const badge = getCompletionBadge('follow_up'); // 73.3%
      expect(badge).toBeNull();
    });
  });

  describe('analyzeTaskPattern()', () => {
    test('detects quote category with high confidence', () => {
      const match = analyzeTaskPattern('Get a quote for new auto policy');
      expect(match?.category).toBe('quote');
      expect(match?.confidence).toBeGreaterThan(0.5);
    });

    test('returns null for very short text', () => {
      const match = analyzeTaskPattern('call');
      expect(match).toBeNull();
    });

    test('suggests priority based on category', () => {
      const match = analyzeTaskPattern('Process claim for customer accident');
      expect(match?.suggestedPriority).toBe('urgent');
    });
  });

  describe('INSURANCE_QUICK_TASKS order', () => {
    test('Follow-up is in top 2 positions', () => {
      const followUpIndex = INSURANCE_QUICK_TASKS.findIndex(
        t => t.category === 'follow_up'
      );
      expect(followUpIndex).toBeLessThanOrEqual(1);
    });

    test('Policy Review is first', () => {
      expect(INSURANCE_QUICK_TASKS[0].category).toBe('policy_review');
    });
  });
});
```

### 7.2 E2E Tests

**File:** `tests/quick-tasks-e2e.spec.ts`

```typescript
describe('Quick Task Buttons E2E', () => {
  test('shows completion badges on task buttons', async ({ page }) => {
    await page.goto('/');
    // Login and navigate to task creation

    // Payment should have 💯 badge
    const paymentBadge = page.locator('[data-category="payment"] .badge');
    await expect(paymentBadge).toHaveText('💯');

    // Quote should have ⚠️ badge
    const quoteBadge = page.locator('[data-category="quote"] .badge');
    await expect(quoteBadge).toHaveText('⚠️');
  });

  test('shows warning toast when selecting Quote template', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-category="quote"]');

    const toast = page.locator('[role="alert"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Quote tasks can be complex');

    // Auto-dismiss after 5 seconds
    await page.waitForTimeout(5500);
    await expect(toast).not.toBeVisible();
  });

  test('shows AI confidence indicator for typed text', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="task-input"]', 'Get quote for new customer auto policy');

    const indicator = page.locator('[aria-label="AI task analysis"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('Detected: Quote');
  });

  test('responsive grid shows 6 templates on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const visibleButtons = page.locator('.quick-task-button:visible');
    await expect(visibleButtons).toHaveCount(6);
  });

  test('responsive grid shows 4 templates on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const visibleButtons = page.locator('.quick-task-button:visible');
    await expect(visibleButtons).toHaveCount(4);
  });
});
```

### 7.3 Accessibility Tests

```typescript
describe('Accessibility', () => {
  test('badges have aria-labels', async ({ page }) => {
    const badge = page.locator('[data-category="payment"] [role="img"]');
    await expect(badge).toHaveAttribute('aria-label', /100% completion rate/);
  });

  test('warning toast has role="alert"', async ({ page }) => {
    await page.click('[data-category="quote"]');
    const toast = page.locator('[role="alert"]');
    await expect(toast).toBeVisible();
  });

  test('confidence indicator is keyboard accessible', async ({ page }) => {
    await page.fill('[data-testid="task-input"]', 'Quote request for customer');
    await page.keyboard.press('Tab');
    const applyButton = page.locator('button:has-text("Apply")');
    await expect(applyButton).toBeFocused();
  });
});
```

---

## 8. Implementation Order

### Recommended Sequence

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 1 | Reorder INSURANCE_QUICK_TASKS | 30 min | None |
| 2 | Add quote warning toast | 1 hour | Phase 1 |
| 3 | Add completion rate badges | 1.5 hours | Phase 1 |
| 4 | Responsive grid (6/4 templates) | 45 min | Phase 1 |
| 5 | CategoryConfidenceIndicator | 3 hours | Phase 3 |
| 6 | Unit tests | 1.5 hours | Phase 1-5 |
| 7 | E2E tests | 2 hours | Phase 1-5 |

**Total Estimated Time: 10 hours**

### Phase 1 + 2 (Day 1 - Quick Wins)

High-impact, low-effort changes:
- Reorder quick tasks (30 min)
- Add quote warning (1 hour)

### Phase 3 + 4 (Day 2 - Visual Polish)

Visual enhancements:
- Completion badges (1.5 hours)
- Responsive grid (45 min)

### Phase 5 (Day 3 - Complex Feature)

Most complex implementation:
- CategoryConfidenceIndicator component (3 hours)
- AddTodo integration
- Testing

---

## 9. Rollback Strategy

### Feature Flag Approach

Each improvement can be independently toggled:

```typescript
// src/lib/featureFlags.ts
export const DATA_DRIVEN_FEATURES = {
  REORDERED_QUICK_TASKS: true,      // Phase 1
  QUOTE_WARNING_TOAST: true,         // Phase 2
  COMPLETION_BADGES: true,           // Phase 3
  RESPONSIVE_GRID: true,             // Phase 4
  AI_CONFIDENCE_INDICATOR: true,     // Phase 5
};
```

### Conditional Rendering

```typescript
// QuickTaskButtons.tsx
import { DATA_DRIVEN_FEATURES } from '@/lib/featureFlags';

{DATA_DRIVEN_FEATURES.COMPLETION_BADGES && badge && (
  <span className="badge">...</span>
)}
```

### Rollback Steps

1. Set feature flag to `false`
2. Deploy
3. Monitor for issues
4. Investigate and fix
5. Re-enable flag

---

## 10. Monitoring & Analytics

### Events to Track

```typescript
// Track template selection
analytics.track('quick_task_selected', {
  category: template.category,
  position: index,
  hadBadge: !!badge,
});

// Track warning dismissal
analytics.track('quote_warning_interaction', {
  action: 'dismissed' | 'auto_dismissed',
  timeVisible: milliseconds,
});

// Track AI suggestion acceptance
analytics.track('ai_suggestion_interaction', {
  action: 'accepted' | 'dismissed',
  category: patternMatch.category,
  confidence: patternMatch.confidence,
});
```

### Success Metrics Query

```sql
-- Quote completion rate over time
SELECT
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) FILTER (WHERE completed) * 100.0 / COUNT(*) as completion_rate
FROM todos
WHERE category = 'quote'
GROUP BY week
ORDER BY week;

-- Follow-up visibility check
SELECT
  template_position,
  COUNT(*) as selections
FROM quick_task_selections
GROUP BY template_position
ORDER BY selections DESC;
```

---

## 11. Code Review Checklist

### Before Merging

- [ ] **Phase 1**: `INSURANCE_QUICK_TASKS` reordered by frequency
- [ ] **Phase 1**: Follow-up is in position 0 or 1
- [ ] **Phase 2**: Quote warning toast shows on selection
- [ ] **Phase 2**: Toast auto-dismisses after 5 seconds
- [ ] **Phase 2**: Toast has `role="alert"`
- [ ] **Phase 3**: Badges render for 90%+ and <60% categories
- [ ] **Phase 3**: Badges have `aria-label` for accessibility
- [ ] **Phase 4**: Desktop shows 6 templates
- [ ] **Phase 4**: Mobile (<640px) shows 4 templates
- [ ] **Phase 5**: CategoryConfidenceIndicator renders when text > 10 chars
- [ ] **Phase 5**: "Apply" button sets priority and subtasks
- [ ] **Phase 5**: "Dismiss" button clears pattern match
- [ ] **General**: No TypeScript errors
- [ ] **General**: Dark mode renders correctly
- [ ] **General**: All tests pass

---

## 12. Related Documentation

| Document | Purpose |
|----------|---------|
| [DATA_DRIVEN_TASK_UX_PLAN.md](./DATA_DRIVEN_TASK_UX_PLAN.md) | UX specifications and requirements |
| [UX_IMPROVEMENTS_TECH_LEAD_REPORT.md](./UX_IMPROVEMENTS_TECH_LEAD_REPORT.md) | Executive summary of all UX improvements |
| [TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md](./TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md) | Related accessibility patterns |
| [TASK_ASSIGNMENT_CARD_TECH_ARCHITECTURE.md](./TASK_ASSIGNMENT_CARD_TECH_ARCHITECTURE.md) | Related component architecture |

---

## 13. Appendix

### A. Complete Badge Logic

```typescript
// Full implementation of getCompletionBadge
import { CATEGORY_COMPLETION_RATES } from '@/lib/insurancePatterns';
import { TaskCategory } from '@/types/todo';

interface CompletionBadge {
  emoji: string;
  tooltip: string;
}

export function getCompletionBadge(category: TaskCategory): CompletionBadge | null {
  const rate = CATEGORY_COMPLETION_RATES[category];

  // High performers (90%+)
  if (rate >= 90) {
    return {
      emoji: '💯',
      tooltip: `${rate}% completion rate - you crush these tasks!`,
    };
  }

  // Low performers (<60%)
  if (rate < 60) {
    return {
      emoji: '⚠️',
      tooltip: `${rate}% completion rate - consider breaking into smaller steps`,
    };
  }

  // Medium performers (60-89%) - no badge
  return null;
}
```

### B. Category Name Formatting

```typescript
export function formatCategoryName(category: TaskCategory): string {
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

### C. Completion Rate Reference

| Category | Rate | Badge | Notes |
|----------|------|-------|-------|
| payment | 100% | 💯 | Best performer |
| new_client | 100% | 💯 | Best performer |
| claim | 87.5% | - | Good |
| vehicle_add | 84.2% | - | Good |
| cancellation | 80% | - | Good |
| endorsement | 78.6% | - | Good |
| follow_up | 73.3% | - | Acceptable |
| policy_review | 71.9% | - | Acceptable |
| documentation | 66.7% | - | Acceptable |
| quote | 50% | ⚠️ | Needs attention |
| other | 33.3% | ⚠️ | Needs attention |

---

**Document Version:** 1.0
**Last Updated:** 2026-01-15
**Author:** Tech Lead
