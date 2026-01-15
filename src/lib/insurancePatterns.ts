/**
 * Insurance Task Pattern Recognition
 *
 * Based on data analysis of 76+ real tasks showing:
 * - Policy Review/Renewal: 42% (71.9% completion)
 * - Follow-up/Communication: 40% (73.3% completion)
 * - Vehicle/Auto Changes: 25% (84.2% completion)
 * - Payment/Billing: 18% (100% completion)
 * - Endorsement/Change: 18% (78.6% completion)
 * - Claims: 10.5% (87.5% completion)
 * - Quotes/Proposals: 10.5% (50% completion - needs improvement)
 *
 * This module provides intelligent task categorization and
 * context-aware subtask suggestions.
 */

import { TaskCategory, TodoPriority } from '@/types/todo';

export interface TaskPatternMatch {
  category: TaskCategory;
  confidence: number; // 0-1, how confident we are in the match
  suggestedPriority: TodoPriority;
  suggestedSubtasks: string[];
  estimatedMinutes: number[];
  tips?: string; // Helpful context for the user
}

interface PatternDefinition {
  category: TaskCategory;
  keywords: string[];
  patterns: RegExp[];
  defaultPriority: TodoPriority;
  subtasks: Array<{ text: string; estimatedMinutes: number }>;
  tips?: string;
}

/**
 * Pattern definitions based on real task analysis
 * Ordered by frequency (most common first)
 */
const TASK_PATTERNS: PatternDefinition[] = [
  // 1. Policy Review/Renewal (42%)
  {
    category: 'policy_review',
    keywords: ['policy', 'renewal', 'review', 'coverage', 'dec page', 'declarations', 'renew'],
    patterns: [
      /policy\s*(review|renewal)/i,
      /renew\w*/i,
      /review\s*(policy|coverage)/i,
      /coverage\s*(review|check|limits)/i,
      /dec(larations)?\s*page/i,
      /mileage\s*(statement|questionnaire|usage)/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Review current coverage limits and deductibles', estimatedMinutes: 15 },
      { text: 'Check for available discounts', estimatedMinutes: 10 },
      { text: 'Verify customer contact information', estimatedMinutes: 5 },
      { text: 'Prepare renewal quote if applicable', estimatedMinutes: 20 },
    ],
  },

  // 2. Follow-up/Communication (40%)
  {
    category: 'follow_up',
    keywords: ['call', 'follow up', 'contact', 'voicemail', 'call back', 'reach out', 'phone'],
    patterns: [
      /call\s*(back)?/i,
      /follow\s*up/i,
      /contact\s*(customer|client)?/i,
      /voicemail/i,
      /reach\s*out/i,
      /phone\s*(call)?/i,
      /return\s*(call|message)/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Review account notes before call', estimatedMinutes: 5 },
      { text: 'Make call or leave voicemail', estimatedMinutes: 10 },
      { text: 'Document conversation in notes', estimatedMinutes: 5 },
      { text: 'Schedule follow-up if needed', estimatedMinutes: 2 },
    ],
    tips: 'Follow-up tasks have high urgency - consider marking as high priority if time-sensitive.',
  },

  // 3. Vehicle/Auto Changes (25%) - 84% completion rate
  {
    category: 'vehicle_add',
    keywords: ['vehicle', 'car', 'auto', 'vin', 'add car', 'remove vehicle', 'new car', 'swap', 'tesla', 'driver'],
    patterns: [
      /add\s*(new\s*)?(vehicle|car|auto)/i,
      /remove\s*(vehicle|car|auto)/i,
      /(vehicle|car)\s*(add|change|switch|swap)/i,
      /new\s*(vehicle|car)/i,
      /vin/i,
      /driver\s*(add|remove|change)/i,
      /tesla|ford|toyota|honda|chevy|chevrolet/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Collect VIN and vehicle information', estimatedMinutes: 10 },
      { text: 'Verify registration document', estimatedMinutes: 5 },
      { text: 'Calculate premium change', estimatedMinutes: 15 },
      { text: 'Process change with carrier', estimatedMinutes: 10 },
      { text: 'Send updated declarations page', estimatedMinutes: 5 },
    ],
    tips: 'Vehicle changes have 84% completion rate - clear, actionable tasks.',
  },

  // 4. Payment/Billing (18%) - 100% completion rate!
  {
    category: 'payment',
    keywords: ['payment', 'billing', 'pay', 'invoice', 'credit card', 'overdue', 'balance', 'charge'],
    patterns: [
      /payment/i,
      /billing\s*(issue)?/i,
      /process\s*payment/i,
      /invoice/i,
      /credit\s*card/i,
      /overdue/i,
      /balance\s*(due)?/i,
      /unsuccessful\s*payment/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Review account payment status', estimatedMinutes: 5 },
      { text: 'Contact carrier if needed', estimatedMinutes: 10 },
      { text: 'Process payment or resolve issue', estimatedMinutes: 10 },
      { text: 'Confirm resolution with customer', estimatedMinutes: 5 },
    ],
    tips: 'Payment tasks have 100% completion rate - clear success criteria help!',
  },

  // 5. Endorsement/Policy Change (18%)
  {
    category: 'endorsement',
    keywords: ['endorsement', 'change', 'update', 'modify', 'amendment', 'add coverage', 'remove coverage'],
    patterns: [
      /endorsement/i,
      /policy\s*(change|update|modification)/i,
      /(add|remove)\s*coverage/i,
      /update\s*(policy|coverage)/i,
      /modify\s*(policy)?/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Review requested change details', estimatedMinutes: 10 },
      { text: 'Calculate premium impact', estimatedMinutes: 15 },
      { text: 'Process endorsement with carrier', estimatedMinutes: 15 },
      { text: 'Send updated declarations page', estimatedMinutes: 5 },
    ],
  },

  // 6. Claims (10.5%) - 87.5% completion rate
  {
    category: 'claim',
    keywords: ['claim', 'accident', 'loss', 'damage', 'incident', 'adjuster', 'collision'],
    patterns: [
      /claim/i,
      /accident/i,
      /file\s*(claim|loss)/i,
      /loss\s*(report|notice)/i,
      /adjuster/i,
      /damage\s*(report)?/i,
    ],
    defaultPriority: 'urgent',
    subtasks: [
      { text: 'File claim with carrier', estimatedMinutes: 20 },
      { text: 'Document incident details thoroughly', estimatedMinutes: 15 },
      { text: 'Coordinate with adjuster', estimatedMinutes: 15 },
      { text: 'Follow up on claim status', estimatedMinutes: 10 },
      { text: 'Update customer on progress', estimatedMinutes: 10 },
    ],
    tips: 'Claims are time-sensitive - consider marking as urgent.',
  },

  // 7. Quotes/Proposals (10.5%) - 50% completion rate (needs improvement!)
  {
    category: 'quote',
    keywords: ['quote', 'proposal', 'requote', 'estimate', 'price', 'rate', 'compare'],
    patterns: [
      /quote/i,
      /requote/i,
      /proposal/i,
      /rate\s*(comparison|check)/i,
      /price\s*(check|comparison)/i,
      /compare\s*(rates|quotes)/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Collect all required customer information', estimatedMinutes: 15 },
      { text: 'Pull MVR and claims history', estimatedMinutes: 10 },
      { text: 'Run quotes with multiple carriers', estimatedMinutes: 30 },
      { text: 'Compare coverage options and pricing', estimatedMinutes: 15 },
      { text: 'Prepare proposal document', estimatedMinutes: 20 },
      { text: 'Send quote and schedule follow-up call', estimatedMinutes: 10 },
    ],
    tips: 'Quotes have only 50% completion rate - break into smaller steps and set clear deadlines.',
  },

  // 8. Documentation (12%)
  {
    category: 'documentation',
    keywords: ['document', 'upload', 'send', 'email', 'copy', 'certificate', 'id card'],
    patterns: [
      /upload\s*(document|file)/i,
      /send\s*(document|copy|email)/i,
      /email\s*(copy|document)/i,
      /certificate\s*(of\s*insurance)?/i,
      /id\s*card/i,
      /proof\s*of\s*insurance/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Locate requested documents', estimatedMinutes: 5 },
      { text: 'Verify document accuracy and current', estimatedMinutes: 5 },
      { text: 'Email documents to customer', estimatedMinutes: 5 },
      { text: 'Confirm receipt with customer', estimatedMinutes: 5 },
    ],
  },

  // 9. New Client Onboarding (2.6%) - 100% completion rate
  {
    category: 'new_client',
    keywords: ['new client', 'onboarding', 'new customer', 'sign up', 'new policy'],
    patterns: [
      /new\s*(client|customer)/i,
      /onboarding/i,
      /sign\s*up/i,
      /new\s*policy/i,
      /welcome\s*(packet|email)/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Gather customer information', estimatedMinutes: 15 },
      { text: 'Pull MVR for all drivers', estimatedMinutes: 10 },
      { text: 'Run quotes with multiple carriers', estimatedMinutes: 30 },
      { text: 'Present options and bind coverage', estimatedMinutes: 20 },
      { text: 'Set up account in management system', estimatedMinutes: 10 },
      { text: 'Send welcome packet', estimatedMinutes: 5 },
    ],
    tips: 'New client tasks have 100% completion rate - thorough onboarding pays off!',
  },

  // 10. Cancellation (6.6%)
  {
    category: 'cancellation',
    keywords: ['cancel', 'cancellation', 'terminate', 'end policy', 'non-renewal'],
    patterns: [
      /cancel/i,
      /cancellation/i,
      /terminate\s*(policy)?/i,
      /non-?renewal/i,
      /end\s*policy/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Verify cancellation request details', estimatedMinutes: 5 },
      { text: 'Offer retention options if applicable', estimatedMinutes: 10 },
      { text: 'Process cancellation with carrier', estimatedMinutes: 10 },
      { text: 'Send confirmation to customer', estimatedMinutes: 5 },
      { text: 'Update account records', estimatedMinutes: 5 },
    ],
    tips: 'Try retention options before processing - some cancellations can be saved.',
  },
];

/**
 * Analyzes task text and returns the best matching pattern with suggestions
 */
export function analyzeTaskPattern(taskText: string): TaskPatternMatch | null {
  const normalizedText = taskText.toLowerCase();
  let bestMatch: { pattern: PatternDefinition; score: number } | null = null;

  for (const pattern of TASK_PATTERNS) {
    let score = 0;

    // Check keyword matches
    for (const keyword of pattern.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Check regex pattern matches (higher weight)
    for (const regex of pattern.patterns) {
      if (regex.test(taskText)) {
        score += 2;
      }
    }

    // Update best match if this is better
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { pattern, score };
    }
  }

  if (!bestMatch) {
    return null;
  }

  // Calculate confidence (0-1) based on score
  // Max possible score would be keywords.length + patterns.length * 2
  const maxScore = bestMatch.pattern.keywords.length + bestMatch.pattern.patterns.length * 2;
  const confidence = Math.min(bestMatch.score / maxScore, 1);

  return {
    category: bestMatch.pattern.category,
    confidence,
    suggestedPriority: bestMatch.pattern.defaultPriority,
    suggestedSubtasks: bestMatch.pattern.subtasks.map(s => s.text),
    estimatedMinutes: bestMatch.pattern.subtasks.map(s => s.estimatedMinutes),
    tips: bestMatch.pattern.tips,
  };
}

/**
 * Gets category-specific subtasks for AI to use as context
 */
export function getCategorySubtasks(category: TaskCategory): Array<{ text: string; estimatedMinutes: number }> {
  const pattern = TASK_PATTERNS.find(p => p.category === category);
  return pattern?.subtasks || [];
}

/**
 * Gets all pattern definitions for AI context injection
 */
export function getAllPatternDefinitions(): string {
  return TASK_PATTERNS.map(p => {
    const subtaskList = p.subtasks.map(s => `  - ${s.text} (~${s.estimatedMinutes} min)`).join('\n');
    return `${p.category.toUpperCase()} (${p.defaultPriority} priority):
${subtaskList}`;
  }).join('\n\n');
}

/**
 * Category completion rate data for smart prioritization
 */
export const CATEGORY_COMPLETION_RATES: Record<TaskCategory, number> = {
  payment: 100,
  new_client: 100,
  claim: 87.5,
  vehicle_add: 84.2,
  cancellation: 80,
  endorsement: 78.6,
  follow_up: 73.3,
  policy_review: 71.9,
  documentation: 66.7,
  quote: 50, // Lowest - needs attention
  other: 33.3,
};

/**
 * Get completion rate warning if task category has low completion
 */
export function getCompletionRateWarning(category: TaskCategory): string | null {
  const rate = CATEGORY_COMPLETION_RATES[category];
  if (rate < 60) {
    return `This task type has a ${rate}% historical completion rate. Consider breaking it into smaller steps.`;
  }
  return null;
}
