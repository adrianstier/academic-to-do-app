/**
 * Grant Budget Tracking Types
 *
 * Types for tracking grant budgets, expenses, and category allocations
 * within the academic project management system.
 */

export interface BudgetCategory {
  id: string;
  name: string;           // e.g., "Personnel", "Equipment", "Travel", "Supplies", "Other"
  allocated: number;
  spent: number;
  color: string;
}

export interface BudgetExpense {
  id: string;
  project_id: string;
  category_id: string;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

export interface ProjectBudget {
  project_id: string;
  total_budget: number;
  currency: string;       // default 'USD'
  fiscal_year: string;
  categories: BudgetCategory[];
  expenses: BudgetExpense[];
  notes?: string;
}

export const DEFAULT_BUDGET_CATEGORIES: Omit<BudgetCategory, 'id' | 'allocated' | 'spent'>[] = [
  { name: 'Personnel', color: '#3B82F6' },
  { name: 'Equipment', color: '#8B5CF6' },
  { name: 'Travel', color: '#10B981' },
  { name: 'Supplies', color: '#F59E0B' },
  { name: 'Publication Fees', color: '#EC4899' },
  { name: 'Subcontracts', color: '#6366F1' },
  { name: 'Other Direct Costs', color: '#64748B' },
];

/**
 * Budget template presets for common funding agencies.
 * Each template provides standard categories with suggested allocation percentages.
 */
export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  categories: Omit<BudgetCategory, 'id' | 'allocated' | 'spent'>[];
}

export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: 'nsf',
    name: 'NSF Standard',
    description: 'National Science Foundation standard budget categories',
    categories: [
      { name: 'Senior Personnel', color: '#3B82F6' },
      { name: 'Other Personnel', color: '#60A5FA' },
      { name: 'Fringe Benefits', color: '#2563EB' },
      { name: 'Equipment', color: '#8B5CF6' },
      { name: 'Travel (Domestic)', color: '#10B981' },
      { name: 'Travel (International)', color: '#059669' },
      { name: 'Participant Support', color: '#F59E0B' },
      { name: 'Other Direct Costs', color: '#64748B' },
      { name: 'Indirect Costs', color: '#94A3B8' },
    ],
  },
  {
    id: 'nih',
    name: 'NIH Standard',
    description: 'National Institutes of Health standard budget categories',
    categories: [
      { name: 'Personnel (Salary & Wages)', color: '#3B82F6' },
      { name: 'Fringe Benefits', color: '#2563EB' },
      { name: 'Equipment', color: '#8B5CF6' },
      { name: 'Travel', color: '#10B981' },
      { name: 'Supplies', color: '#F59E0B' },
      { name: 'Contractual (Subcontracts)', color: '#6366F1' },
      { name: 'Patient Care Costs', color: '#EC4899' },
      { name: 'Alterations & Renovations', color: '#F97316' },
      { name: 'Publication Costs', color: '#14B8A6' },
      { name: 'Other Expenses', color: '#64748B' },
      { name: 'Consortium/Sub-award Costs', color: '#A855F7' },
      { name: 'Indirect (F&A) Costs', color: '#94A3B8' },
    ],
  },
  {
    id: 'generic',
    name: 'Generic Research',
    description: 'Common categories for general research grants',
    categories: DEFAULT_BUDGET_CATEGORIES,
  },
];
