/**
 * Academic Task Pattern Recognition
 *
 * Pattern recognition for academic/research task management including:
 * - Research: literature review, data collection, experiments, studies
 * - Writing: drafts, papers, manuscripts, thesis, dissertation
 * - Analysis: statistics, data analysis, R, Python, SPSS
 * - Submission: deadlines, conference, journal submissions
 * - Meeting: advisor, committee, lab meetings, seminars, office hours
 * - Presentation: defense, poster, talks, slides
 * - Reading: articles, chapters, textbook, review papers
 * - Coursework: assignments, homework, exams, quizzes
 * - Revision: edits, feedback, reviewer comments
 * - Admin: forms, registration, IRB, grant administration
 *
 * This module provides intelligent task categorization and
 * context-aware subtask suggestions for academic workflows.
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
 * Pattern definitions for academic tasks
 * Ordered by typical workflow frequency
 */
const TASK_PATTERNS: PatternDefinition[] = [
  // 1. Research - literature review, experiments, data collection
  {
    category: 'research',
    keywords: ['literature review', 'data collection', 'experiment', 'study', 'hypothesis', 'methodology', 'research', 'pilot', 'participant', 'sample', 'protocol'],
    patterns: [
      /literature\s*review/i,
      /data\s*collection/i,
      /run\s*(experiment|study)/i,
      /pilot\s*(study|test)/i,
      /recruit\s*participants/i,
      /research\s*(design|method|protocol)/i,
      /hypothesis/i,
      /IRB\s*protocol/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Define research questions and objectives', estimatedMinutes: 30 },
      { text: 'Search databases for relevant sources', estimatedMinutes: 60 },
      { text: 'Review and annotate key materials', estimatedMinutes: 90 },
      { text: 'Document findings and gaps', estimatedMinutes: 45 },
    ],
    tips: 'Break large research tasks into weekly milestones to track progress effectively.',
  },

  // 2. Writing - drafts, papers, manuscripts, thesis
  {
    category: 'writing',
    keywords: ['draft', 'paper', 'manuscript', 'thesis', 'dissertation', 'abstract', 'write', 'introduction', 'conclusion', 'methods', 'results', 'discussion'],
    patterns: [
      /write\s*(draft|paper|manuscript|thesis|dissertation|abstract)/i,
      /(draft|revise)\s*(the\s*)?(introduction|conclusion|methods|results|discussion)/i,
      /manuscript\s*(draft|revision)/i,
      /thesis\s*(chapter|section)/i,
      /dissertation\s*(writing|progress)/i,
      /abstract\s*(submission|draft)/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Create outline and structure', estimatedMinutes: 30 },
      { text: 'Write first draft', estimatedMinutes: 120 },
      { text: 'Add citations and references', estimatedMinutes: 45 },
      { text: 'Revise and edit', estimatedMinutes: 60 },
    ],
    tips: 'Consider using the Pomodoro technique for focused writing sessions.',
  },

  // 3. Analysis - statistics, data analysis, coding
  {
    category: 'analysis',
    keywords: ['statistics', 'data analysis', 'results', 'python', 'SPSS', 'stata', 'analysis', 'regression', 'visualization', 'plot', 'figure', 'table'],
    patterns: [
      /data\s*analysis/i,
      /run\s*(statistics|regression|anova|t-test)/i,
      /(analyze|process)\s*(data|results)/i,
      /create\s*(visualization|plot|figure|table)/i,
      /\b(R|python|SPSS|stata)\s*(script|code|analysis)/i,
      /statistical\s*(analysis|test)/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Clean and prepare data', estimatedMinutes: 45 },
      { text: 'Run statistical analyses', estimatedMinutes: 60 },
      { text: 'Create visualizations and figures', estimatedMinutes: 45 },
      { text: 'Document results and interpretations', estimatedMinutes: 30 },
    ],
    tips: 'Document your analysis code with comments for reproducibility.',
  },

  // 4. Submission - conference, journal, deadlines
  {
    category: 'submission',
    keywords: ['submit', 'deadline', 'conference', 'journal', 'review', 'camera ready', 'submission', 'supplementary', 'cover letter'],
    patterns: [
      /submit\s*(to|paper|manuscript)/i,
      /(conference|journal)\s*(submission|deadline)/i,
      /deadline/i,
      /camera\s*ready/i,
      /submit\s*(by|before)/i,
      /(prepare|upload)\s*supplementary/i,
    ],
    defaultPriority: 'urgent',
    subtasks: [
      { text: 'Review submission guidelines', estimatedMinutes: 20 },
      { text: 'Format manuscript according to requirements', estimatedMinutes: 60 },
      { text: 'Prepare supplementary materials', estimatedMinutes: 45 },
      { text: 'Complete submission form and upload', estimatedMinutes: 30 },
      { text: 'Verify submission receipt', estimatedMinutes: 5 },
    ],
    tips: 'Submit at least 2 hours before deadline to avoid technical issues.',
  },

  // 5. Meeting - advisor, committee, lab meetings
  {
    category: 'meeting',
    keywords: ['advisor', 'committee', 'lab meeting', 'seminar', 'office hours', 'meeting', 'supervisor', 'mentor', 'PI', 'group meeting'],
    patterns: [
      /meet(ing)?\s*(with\s*)?(advisor|supervisor|committee|mentor|PI)/i,
      /advisor\s*meeting/i,
      /committee\s*meeting/i,
      /lab\s*meeting/i,
      /office\s*hours/i,
      /(group|team)\s*meeting/i,
      /seminar\s*(presentation|attendance)/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Prepare agenda and talking points', estimatedMinutes: 20 },
      { text: 'Review previous meeting notes', estimatedMinutes: 10 },
      { text: 'Prepare progress update and materials', estimatedMinutes: 30 },
      { text: 'Document action items after meeting', estimatedMinutes: 15 },
    ],
    tips: 'Send agenda to attendees at least 24 hours before the meeting.',
  },

  // 6. Presentation - defense, poster, talks
  {
    category: 'presentation',
    keywords: ['defense', 'poster', 'talk', 'slides', 'conference presentation', 'presentation', 'present', 'seminar talk', 'keynote', 'powerpoint'],
    patterns: [
      /prepare\s*(presentation|slides|talk|poster)/i,
      /(thesis|dissertation)\s*defense/i,
      /conference\s*(presentation|talk|poster)/i,
      /poster\s*(session|presentation)/i,
      /seminar\s*talk/i,
      /practice\s*(presentation|talk)/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Create slide deck or poster', estimatedMinutes: 90 },
      { text: 'Prepare speaker notes', estimatedMinutes: 30 },
      { text: 'Practice presentation', estimatedMinutes: 45 },
      { text: 'Get feedback and revise', estimatedMinutes: 30 },
    ],
    tips: 'Practice your presentation at least 3 times before delivery.',
  },

  // 7. Reading - articles, chapters, textbooks
  {
    category: 'reading',
    keywords: ['article', 'chapter', 'textbook', 'review paper', 'read', 'paper', 'reading', 'skim', 'annotate'],
    patterns: [
      /read\s*(article|paper|chapter|textbook)/i,
      /(review|skim)\s*(paper|article)/i,
      /annotate\s*(paper|article)/i,
      /reading\s*(list|assignment)/i,
      /summarize\s*(paper|article|chapter)/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'First pass: skim for main ideas', estimatedMinutes: 15 },
      { text: 'Second pass: detailed reading with notes', estimatedMinutes: 45 },
      { text: 'Identify key concepts and takeaways', estimatedMinutes: 15 },
      { text: 'Write summary of main findings', estimatedMinutes: 20 },
    ],
    tips: 'Use the three-pass method: skim, read in detail, then analyze critically.',
  },

  // 8. Coursework - assignments, homework, exams
  {
    category: 'coursework',
    keywords: ['assignment', 'homework', 'exam', 'quiz', 'grade', 'course', 'class', 'problem set', 'lab report', 'midterm', 'final'],
    patterns: [
      /complete\s*(assignment|homework|problem set)/i,
      /(study|prepare)\s*(for\s*)?(exam|quiz|midterm|final)/i,
      /lab\s*report/i,
      /course\s*(project|assignment)/i,
      /grade\s*(paper|assignment)/i,
      /(turn|hand)\s*in/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Review assignment requirements', estimatedMinutes: 10 },
      { text: 'Gather necessary resources', estimatedMinutes: 15 },
      { text: 'Complete main work', estimatedMinutes: 90 },
      { text: 'Review and proofread', estimatedMinutes: 20 },
      { text: 'Submit before deadline', estimatedMinutes: 5 },
    ],
    tips: 'Start assignments early to allow time for questions and revisions.',
  },

  // 9. Revision - edits, feedback, reviewer comments
  {
    category: 'revision',
    keywords: ['revise', 'edits', 'feedback', 'reviewer comments', 'revision', 'resubmission', 'response', 'rebuttal', 'corrections'],
    patterns: [
      /address\s*(reviewer\s*)?comments/i,
      /revise\s*(manuscript|paper|draft)/i,
      /respond\s*to\s*(reviewer|feedback)/i,
      /make\s*(edits|corrections|revisions)/i,
      /resubmit/i,
      /point-by-point\s*response/i,
    ],
    defaultPriority: 'high',
    subtasks: [
      { text: 'Read all feedback/comments thoroughly', estimatedMinutes: 30 },
      { text: 'Create response document', estimatedMinutes: 20 },
      { text: 'Make revisions to manuscript', estimatedMinutes: 120 },
      { text: 'Write point-by-point response letter', estimatedMinutes: 60 },
      { text: 'Review changes and submit', estimatedMinutes: 30 },
    ],
    tips: 'Address each reviewer comment systematically and professionally.',
  },

  // 10. Admin - forms, registration, IRB, grants
  {
    category: 'admin',
    keywords: ['forms', 'registration', 'IRB', 'grant administration', 'paperwork', 'reimbursement', 'travel', 'expense', 'application', 'administrative'],
    patterns: [
      /complete\s*(form|application|paperwork)/i,
      /IRB\s*(submission|amendment|renewal)/i,
      /grant\s*(application|report|administration)/i,
      /(travel|expense)\s*reimbursement/i,
      /register\s*(for|course)/i,
      /submit\s*(report|form)/i,
    ],
    defaultPriority: 'medium',
    subtasks: [
      { text: 'Gather required documents and information', estimatedMinutes: 20 },
      { text: 'Complete all form sections', estimatedMinutes: 30 },
      { text: 'Get necessary signatures/approvals', estimatedMinutes: 15 },
      { text: 'Submit and confirm receipt', estimatedMinutes: 10 },
    ],
    tips: 'Keep copies of all submitted forms and confirmation numbers.',
  },
];

/**
 * Analyzes task text and returns the best matching pattern with suggestions
 */
export function analyzeTaskPattern(taskText: string): TaskPatternMatch | null {
  // Validate input - protect against empty or excessively long strings
  if (!taskText || typeof taskText !== 'string' || taskText.length > 1000) {
    return null;
  }

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
 * These are example rates - should be updated based on actual user data
 */
export const CATEGORY_COMPLETION_RATES: Record<TaskCategory, number> = {
  meeting: 95,        // Meetings have fixed times, high completion
  submission: 90,     // Deadlines drive completion
  coursework: 88,     // Graded work gets done
  presentation: 85,   // Events drive completion
  reading: 75,        // Often gets deprioritized
  admin: 80,          // Required but not urgent
  revision: 78,       // Feedback-driven
  analysis: 72,       // Can be open-ended
  writing: 65,        // Often delayed, hardest to complete
  research: 60,       // Can expand indefinitely
  other: 50,          // Miscellaneous tasks
};

/**
 * Get completion rate warning if task category has low completion
 */
export function getCompletionRateWarning(category: TaskCategory): string | null {
  const rate = CATEGORY_COMPLETION_RATES[category];
  if (rate < 70) {
    return `This task type has a ${rate}% historical completion rate. Consider breaking it into smaller steps with deadlines.`;
  }
  return null;
}
