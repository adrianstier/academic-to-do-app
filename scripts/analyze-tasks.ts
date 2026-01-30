/**
 * Task Analysis Script
 *
 * Fetches all tasks (including completed/archived) from the database
 * and categorizes them to identify common task patterns.
 *
 * Run with: npx tsx scripts/analyze-tasks.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// Task Category Definitions
// ============================================

interface TaskCategory {
  name: string;
  keywords: string[];
  patterns: RegExp[];
  description: string;
}

const TASK_CATEGORIES: TaskCategory[] = [
  {
    name: 'Policy Review/Renewal',
    keywords: ['policy', 'renewal', 'review', 'coverage', 'dec page', 'declaration'],
    patterns: [/policy\s*(review|renewal)/i, /renew/i, /coverage\s*(review|check)/i],
    description: 'Tasks related to reviewing or renewing insurance policies',
  },
  {
    name: 'Vehicle/Auto Changes',
    keywords: ['vehicle', 'car', 'auto', 'vin', 'add vehicle', 'remove vehicle', 'driver'],
    patterns: [/add\s*(vehicle|car|driver)/i, /vehicle\s*(add|change|update)/i, /vin/i],
    description: 'Tasks involving vehicle additions, removals, or changes',
  },
  {
    name: 'New Client/Onboarding',
    keywords: ['new client', 'onboard', 'new customer', 'new policy', 'bind', 'welcome'],
    patterns: [/new\s*(client|customer)/i, /onboard/i, /bind\s*(coverage|policy)/i],
    description: 'Tasks for onboarding new clients',
  },
  {
    name: 'Claims',
    keywords: ['claim', 'accident', 'loss', 'adjuster', 'incident', 'damage'],
    patterns: [/claim/i, /accident/i, /file\s*(a\s*)?claim/i],
    description: 'Tasks related to insurance claims processing',
  },
  {
    name: 'Quotes/Proposals',
    keywords: ['quote', 'proposal', 'estimate', 'rate', 'pricing'],
    patterns: [/quote/i, /proposal/i, /get\s*(a\s*)?(rate|price)/i],
    description: 'Tasks for generating quotes or proposals',
  },
  {
    name: 'Payment/Billing',
    keywords: ['payment', 'billing', 'invoice', 'premium', 'pay', 'balance', 'due'],
    patterns: [/payment/i, /billing/i, /premium/i, /balance\s*(due)?/i],
    description: 'Tasks related to payments and billing issues',
  },
  {
    name: 'Documentation',
    keywords: ['document', 'paperwork', 'form', 'sign', 'fax', 'email', 'send', 'certificate', 'id card'],
    patterns: [/send\s*(document|form|certificate)/i, /get\s*(document|form|signature)/i, /id\s*card/i],
    description: 'Tasks involving document handling',
  },
  {
    name: 'Follow-up/Communication',
    keywords: ['call', 'follow up', 'followup', 'contact', 'reach out', 'check in', 'callback', 'voicemail'],
    patterns: [/call\s*(back)?/i, /follow\s*up/i, /reach\s*out/i, /voicemail/i],
    description: 'Tasks for customer follow-ups and communication',
  },
  {
    name: 'Endorsement/Change',
    keywords: ['endorsement', 'change', 'update', 'modify', 'add', 'remove', 'adjust'],
    patterns: [/endorsement/i, /policy\s*change/i, /update\s*(policy|coverage)/i],
    description: 'Tasks for policy endorsements and changes',
  },
  {
    name: 'Cancellation',
    keywords: ['cancel', 'cancellation', 'terminate', 'lapse', 'non-renew'],
    patterns: [/cancel/i, /non-?renew/i, /lapse/i],
    description: 'Tasks related to policy cancellations',
  },
  {
    name: 'Administrative',
    keywords: ['meeting', 'training', 'report', 'file', 'organize', 'clean', 'update system'],
    patterns: [/meeting/i, /training/i, /report/i, /admin/i],
    description: 'Internal administrative tasks',
  },
];

// ============================================
// Analysis Types
// ============================================

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  status: string;
  priority: string;
  created_at: string;
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  notes?: string;
  subtasks?: Array<{ text: string; completed: boolean }>;
}

interface CategoryResult {
  category: string;
  count: number;
  percentage: number;
  tasks: Array<{ id: string; text: string; completed: boolean; priority: string }>;
  completionRate: number;
  priorityDistribution: Record<string, number>;
}

interface AnalysisResult {
  totalTasks: number;
  completedTasks: number;
  overallCompletionRate: number;
  categoryBreakdown: CategoryResult[];
  uncategorized: Array<{ id: string; text: string }>;
  priorityOverall: Record<string, number>;
  tasksByUser: Record<string, number>;
  tasksByAssignee: Record<string, number>;
  temporalAnalysis: {
    byMonth: Record<string, number>;
    byDayOfWeek: Record<string, number>;
  };
}

// ============================================
// Categorization Logic
// ============================================

function categorizeTask(taskText: string): string[] {
  const text = taskText.toLowerCase();
  const matchedCategories: string[] = [];

  for (const category of TASK_CATEGORIES) {
    // Check keywords
    const keywordMatch = category.keywords.some(keyword => text.includes(keyword.toLowerCase()));

    // Check patterns
    const patternMatch = category.patterns.some(pattern => pattern.test(taskText));

    if (keywordMatch || patternMatch) {
      matchedCategories.push(category.name);
    }
  }

  return matchedCategories.length > 0 ? matchedCategories : ['Other/Uncategorized'];
}

// ============================================
// Analysis Functions
// ============================================

async function fetchAllTasks(): Promise<Todo[]> {
  console.log('Fetching all tasks from database...');

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }

  console.log(`Found ${data?.length || 0} tasks`);
  return data || [];
}

function analyzeTasksByCategory(tasks: Todo[]): AnalysisResult {
  const categoryMap: Map<string, Todo[]> = new Map();
  const uncategorized: Array<{ id: string; text: string }> = [];

  // Initialize all categories
  for (const cat of TASK_CATEGORIES) {
    categoryMap.set(cat.name, []);
  }
  categoryMap.set('Other/Uncategorized', []);

  // Categorize each task
  for (const task of tasks) {
    const categories = categorizeTask(task.text);

    if (categories.includes('Other/Uncategorized')) {
      uncategorized.push({ id: task.id, text: task.text });
    }

    for (const category of categories) {
      const existing = categoryMap.get(category) || [];
      existing.push(task);
      categoryMap.set(category, existing);
    }
  }

  // Calculate statistics for each category
  const categoryBreakdown: CategoryResult[] = [];

  for (const [categoryName, categoryTasks] of categoryMap) {
    if (categoryTasks.length === 0) continue;

    const completedCount = categoryTasks.filter(t => t.completed).length;
    const priorityDist: Record<string, number> = {};

    for (const task of categoryTasks) {
      priorityDist[task.priority] = (priorityDist[task.priority] || 0) + 1;
    }

    categoryBreakdown.push({
      category: categoryName,
      count: categoryTasks.length,
      percentage: (categoryTasks.length / tasks.length) * 100,
      tasks: categoryTasks.map(t => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        priority: t.priority,
      })),
      completionRate: (completedCount / categoryTasks.length) * 100,
      priorityDistribution: priorityDist,
    });
  }

  // Sort by count descending
  categoryBreakdown.sort((a, b) => b.count - a.count);

  // Overall statistics
  const priorityOverall: Record<string, number> = {};
  const tasksByUser: Record<string, number> = {};
  const tasksByAssignee: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byDayOfWeek: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const task of tasks) {
    // Priority distribution
    priorityOverall[task.priority] = (priorityOverall[task.priority] || 0) + 1;

    // Tasks by creator
    tasksByUser[task.created_by] = (tasksByUser[task.created_by] || 0) + 1;

    // Tasks by assignee
    if (task.assigned_to) {
      tasksByAssignee[task.assigned_to] = (tasksByAssignee[task.assigned_to] || 0) + 1;
    }

    // Temporal analysis
    if (task.created_at) {
      const date = new Date(task.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;

      const dayKey = dayNames[date.getDay()];
      byDayOfWeek[dayKey] = (byDayOfWeek[dayKey] || 0) + 1;
    }
  }

  return {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.completed).length,
    overallCompletionRate: (tasks.filter(t => t.completed).length / tasks.length) * 100,
    categoryBreakdown,
    uncategorized,
    priorityOverall,
    tasksByUser,
    tasksByAssignee,
    temporalAnalysis: {
      byMonth,
      byDayOfWeek,
    },
  };
}

// ============================================
// Report Generation
// ============================================

function generateReport(analysis: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('═'.repeat(70));
  lines.push('                    TASK ANALYSIS REPORT');
  lines.push('                    Academic Project Manager');
  lines.push(`                    Generated: ${new Date().toLocaleString()}`);
  lines.push('═'.repeat(70));
  lines.push('');

  // Executive Summary
  lines.push('## EXECUTIVE SUMMARY');
  lines.push('─'.repeat(50));
  lines.push(`Total Tasks Analyzed:     ${analysis.totalTasks}`);
  lines.push(`Completed Tasks:          ${analysis.completedTasks}`);
  lines.push(`Overall Completion Rate:  ${analysis.overallCompletionRate.toFixed(1)}%`);
  lines.push('');

  // Category Breakdown
  lines.push('## TASK CATEGORIES (by frequency)');
  lines.push('─'.repeat(50));
  lines.push('');
  lines.push(padRight('Category', 35) + padRight('Count', 10) + padRight('%', 10) + 'Completion');
  lines.push('─'.repeat(70));

  for (const cat of analysis.categoryBreakdown) {
    lines.push(
      padRight(cat.category, 35) +
      padRight(String(cat.count), 10) +
      padRight(`${cat.percentage.toFixed(1)}%`, 10) +
      `${cat.completionRate.toFixed(1)}%`
    );
  }
  lines.push('');

  // Priority Distribution
  lines.push('## PRIORITY DISTRIBUTION');
  lines.push('─'.repeat(50));
  const priorityOrder = ['urgent', 'high', 'medium', 'low'];
  for (const priority of priorityOrder) {
    const count = analysis.priorityOverall[priority] || 0;
    const pct = ((count / analysis.totalTasks) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / analysis.totalTasks * 40));
    lines.push(`${padRight(capitalize(priority), 10)} ${padRight(String(count), 6)} (${padRight(pct + '%', 7)}) ${bar}`);
  }
  lines.push('');

  // Tasks by User
  lines.push('## TASKS BY CREATOR');
  lines.push('─'.repeat(50));
  const sortedUsers = Object.entries(analysis.tasksByUser).sort((a, b) => b[1] - a[1]);
  for (const [user, count] of sortedUsers) {
    const pct = ((count / analysis.totalTasks) * 100).toFixed(1);
    lines.push(`${padRight(user, 20)} ${padRight(String(count), 6)} (${pct}%)`);
  }
  lines.push('');

  // Tasks by Assignee
  lines.push('## TASKS BY ASSIGNEE');
  lines.push('─'.repeat(50));
  const sortedAssignees = Object.entries(analysis.tasksByAssignee).sort((a, b) => b[1] - a[1]);
  for (const [user, count] of sortedAssignees) {
    const pct = ((count / analysis.totalTasks) * 100).toFixed(1);
    lines.push(`${padRight(user, 20)} ${padRight(String(count), 6)} (${pct}%)`);
  }
  lines.push('');

  // Temporal Analysis
  lines.push('## TASKS BY MONTH');
  lines.push('─'.repeat(50));
  const sortedMonths = Object.entries(analysis.temporalAnalysis.byMonth).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [month, count] of sortedMonths) {
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(analysis.temporalAnalysis.byMonth)) * 30));
    lines.push(`${padRight(month, 12)} ${padRight(String(count), 6)} ${bar}`);
  }
  lines.push('');

  lines.push('## TASKS BY DAY OF WEEK');
  lines.push('─'.repeat(50));
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (const day of dayOrder) {
    const count = analysis.temporalAnalysis.byDayOfWeek[day] || 0;
    const maxDay = Math.max(...Object.values(analysis.temporalAnalysis.byDayOfWeek));
    const bar = '█'.repeat(Math.round(count / maxDay * 30));
    lines.push(`${padRight(day, 12)} ${padRight(String(count), 6)} ${bar}`);
  }
  lines.push('');

  // Top categories deep dive
  lines.push('## TOP CATEGORY DETAILS');
  lines.push('─'.repeat(50));

  const topCategories = analysis.categoryBreakdown.slice(0, 5);
  for (const cat of topCategories) {
    lines.push('');
    lines.push(`### ${cat.category}`);
    lines.push(`    Tasks: ${cat.count} | Completion: ${cat.completionRate.toFixed(1)}%`);
    lines.push('    Priority breakdown:');
    for (const [priority, count] of Object.entries(cat.priorityDistribution)) {
      lines.push(`      - ${capitalize(priority)}: ${count}`);
    }
    lines.push('    Sample tasks:');
    const samples = cat.tasks.slice(0, 5);
    for (const task of samples) {
      const status = task.completed ? '✓' : '○';
      lines.push(`      ${status} ${truncate(task.text, 55)}`);
    }
  }
  lines.push('');

  // Uncategorized tasks (for review)
  if (analysis.uncategorized.length > 0) {
    lines.push('## UNCATEGORIZED TASKS (Review for new patterns)');
    lines.push('─'.repeat(50));
    lines.push(`Found ${analysis.uncategorized.length} tasks that didn't match existing categories:`);
    lines.push('');
    for (const task of analysis.uncategorized.slice(0, 20)) {
      lines.push(`  • ${truncate(task.text, 60)}`);
    }
    if (analysis.uncategorized.length > 20) {
      lines.push(`  ... and ${analysis.uncategorized.length - 20} more`);
    }
  }
  lines.push('');

  lines.push('═'.repeat(70));
  lines.push('                         END OF REPORT');
  lines.push('═'.repeat(70));

  return lines.join('\n');
}

// Helper functions
function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

// ============================================
// JSON Export for further analysis
// ============================================

function generateJSONExport(analysis: AnalysisResult): string {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    summary: {
      total_tasks: analysis.totalTasks,
      completed_tasks: analysis.completedTasks,
      completion_rate: analysis.overallCompletionRate,
    },
    categories: analysis.categoryBreakdown.map(cat => ({
      name: cat.category,
      count: cat.count,
      percentage: cat.percentage,
      completion_rate: cat.completionRate,
      priority_distribution: cat.priorityDistribution,
    })),
    priority_distribution: analysis.priorityOverall,
    tasks_by_user: analysis.tasksByUser,
    tasks_by_assignee: analysis.tasksByAssignee,
    temporal: analysis.temporalAnalysis,
  }, null, 2);
}

// ============================================
// Main Execution
// ============================================

async function main() {
  try {
    console.log('Starting task analysis...\n');

    // Fetch all tasks
    const tasks = await fetchAllTasks();

    if (tasks.length === 0) {
      console.log('No tasks found in database.');
      return;
    }

    // Analyze tasks
    console.log('Analyzing tasks by category...\n');
    const analysis = analyzeTasksByCategory(tasks);

    // Generate text report
    const report = generateReport(analysis);
    console.log(report);

    // Save JSON export
    const jsonExport = generateJSONExport(analysis);
    const fs = await import('fs');
    const outputPath = './scripts/task-analysis-output.json';
    fs.writeFileSync(outputPath, jsonExport);
    console.log(`\nJSON export saved to: ${outputPath}`);

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

main();
