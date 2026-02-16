'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
  Receipt,
  PieChart,
  BarChart3,
  Calendar,
  X,
} from 'lucide-react';
import type { ProjectBudget, BudgetExpense, BudgetCategory } from '@/types/budget';

// =====================================================================
// Currency Formatter
// =====================================================================

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyPrecise(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// =====================================================================
// Props
// =====================================================================

interface BudgetTrackerProps {
  projectId: string;
  budget: ProjectBudget;
  onUpdateBudget: (budget: ProjectBudget) => void;
  onAddExpense: (expense: Omit<BudgetExpense, 'id' | 'created_at'>) => void;
  onDeleteExpense: (expenseId: string) => void;
  readOnly?: boolean;
}

// =====================================================================
// Sort Types
// =====================================================================

type SortField = 'date' | 'description' | 'category' | 'amount' | 'created_by';
type SortDirection = 'asc' | 'desc';

// =====================================================================
// SVG Donut Chart
// =====================================================================

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ segments, size = 180 }: { segments: DonutSegment[]; size?: number }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-xs text-[var(--text-muted)] dark:text-white/40">No data</p>
      </div>
    );
  }

  const radius = (size - 40) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const strokeWidth = radius * 0.35;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let cumulativeOffset = 0;
  const arcs = segments
    .filter(s => s.value > 0)
    .map((segment) => {
      const pct = segment.value / total;
      const dashLength = pct * circumference;
      const gap = circumference - dashLength;
      const offset = cumulativeOffset;
      cumulativeOffset += dashLength;
      return {
        ...segment,
        dashArray: `${dashLength} ${gap}`,
        dashOffset: -offset,
        pct,
      };
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {/* Background circle */}
      <circle
        cx={centerX}
        cy={centerY}
        r={innerRadius}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={strokeWidth}
        className="dark:opacity-20"
      />
      {/* Data segments */}
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx={centerX}
          cy={centerY}
          r={innerRadius}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={arc.dashOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${centerX} ${centerY})`}
          className="transition-all duration-500"
        >
          <title>{`${arc.label}: ${Math.round(arc.pct * 100)}%`}</title>
        </circle>
      ))}
      {/* Center text */}
      <text
        x={centerX}
        y={centerY - 6}
        textAnchor="middle"
        className="fill-[var(--foreground)] dark:fill-white text-lg font-bold"
        style={{ fontSize: '18px', fontWeight: 700 }}
      >
        {segments.length}
      </text>
      <text
        x={centerX}
        y={centerY + 12}
        textAnchor="middle"
        className="fill-[var(--text-muted)] dark:fill-white/50"
        style={{ fontSize: '11px' }}
      >
        categories
      </text>
    </svg>
  );
}

// =====================================================================
// Monthly Bar Chart (CSS-based)
// =====================================================================

interface MonthlyData {
  label: string;
  amount: number;
}

function MonthlyBarChart({ data, currency }: { data: MonthlyData[]; currency: string }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  if (data.every(d => d.amount === 0)) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-[var(--text-muted)] dark:text-white/40">No spending data yet</p>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((month) => {
        const heightPct = maxAmount > 0 ? (month.amount / maxAmount) * 100 : 0;
        return (
          <div key={month.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative" style={{ height: '100px' }}>
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-500 bg-[var(--brand-blue)] dark:bg-[var(--brand-sky)] hover:opacity-80"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={formatCurrencyPrecise(month.amount, currency)}
              />
            </div>
            <span className="text-[10px] text-[var(--text-muted)] dark:text-white/40 truncate w-full text-center">
              {month.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Main Component
// =====================================================================

export default function BudgetTracker({
  projectId,
  budget,
  onUpdateBudget,
  onAddExpense,
  onDeleteExpense,
  readOnly = false,
}: BudgetTrackerProps) {
  // --- State ---
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // New expense form
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    created_by: '',
  });

  // --- Derived Data ---
  const totalSpent = useMemo(
    () => budget.categories.reduce((sum, c) => sum + c.spent, 0),
    [budget.categories]
  );

  const totalAllocated = useMemo(
    () => budget.categories.reduce((sum, c) => sum + c.allocated, 0),
    [budget.categories]
  );

  const remaining = budget.total_budget - totalSpent;
  const spentPercentage = budget.total_budget > 0
    ? Math.round((totalSpent / budget.total_budget) * 100)
    : 0;

  const isOverBudget = totalSpent > budget.total_budget;
  const isWarning = spentPercentage >= 80 && !isOverBudget;

  // Burn rate calculation
  const burnRate = useMemo(() => {
    if (budget.expenses.length === 0) return null;

    const dates = budget.expenses.map(e => new Date(e.date).getTime());
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);
    const monthsElapsed = Math.max(
      1,
      (latest - earliest) / (1000 * 60 * 60 * 24 * 30)
    );
    const monthlyRate = totalSpent / monthsElapsed;

    // Estimate remaining months from fiscal year
    const fyEnd = new Date(`${budget.fiscal_year}-12-31`);
    const now = new Date();
    const remainingMonths = Math.max(
      0,
      (fyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    return {
      monthlyRate,
      remainingMonths: Math.round(remainingMonths),
      projectedOverspend: monthlyRate * remainingMonths > remaining,
    };
  }, [budget.expenses, budget.fiscal_year, totalSpent, remaining]);

  // Monthly spending data (last 6 months)
  const monthlyData = useMemo((): MonthlyData[] => {
    const now = new Date();
    const months: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const month = d.getMonth();
      const amount = budget.expenses
        .filter(e => {
          const ed = new Date(e.date);
          return ed.getFullYear() === year && ed.getMonth() === month;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      months.push({ label, amount });
    }
    return months;
  }, [budget.expenses]);

  // Donut chart segments
  const donutSegments = useMemo((): DonutSegment[] => {
    return budget.categories
      .filter(c => c.allocated > 0)
      .map(c => ({
        label: c.name,
        value: c.allocated,
        color: c.color,
      }));
  }, [budget.categories]);

  // Filtered + sorted expenses
  const filteredExpenses = useMemo(() => {
    let expenses = [...budget.expenses];

    // Filter by category
    if (filterCategory !== 'all') {
      expenses = expenses.filter(e => e.category_id === filterCategory);
    }

    // Sort
    expenses.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'date':
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
        case 'description':
          return a.description.localeCompare(b.description) * dir;
        case 'category': {
          const catA = budget.categories.find(c => c.id === a.category_id)?.name || '';
          const catB = budget.categories.find(c => c.id === b.category_id)?.name || '';
          return catA.localeCompare(catB) * dir;
        }
        case 'amount':
          return (a.amount - b.amount) * dir;
        case 'created_by':
          return a.created_by.localeCompare(b.created_by) * dir;
        default:
          return 0;
      }
    });

    return expenses;
  }, [budget.expenses, budget.categories, filterCategory, sortField, sortDirection]);

  // Category lookup
  const getCategoryName = useCallback(
    (categoryId: string) => budget.categories.find(c => c.id === categoryId)?.name || 'Unknown',
    [budget.categories]
  );

  const getCategoryColor = useCallback(
    (categoryId: string) => budget.categories.find(c => c.id === categoryId)?.color || '#64748B',
    [budget.categories]
  );

  // --- Handlers ---
  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDirection('desc');
      return field;
    });
  }, []);

  const handleAddExpense = useCallback(() => {
    const amount = parseFloat(newExpense.amount);
    if (!newExpense.description.trim() || isNaN(amount) || amount <= 0 || !newExpense.category_id || !newExpense.created_by.trim()) {
      return;
    }

    onAddExpense({
      project_id: projectId,
      category_id: newExpense.category_id,
      description: newExpense.description.trim(),
      amount,
      date: newExpense.date,
      created_by: newExpense.created_by.trim(),
    });

    setNewExpense({
      description: '',
      amount: '',
      category_id: '',
      date: new Date().toISOString().split('T')[0],
      created_by: newExpense.created_by, // Keep the same user
    });
    setShowAddExpense(false);
  }, [newExpense, projectId, onAddExpense]);

  const handleDeleteExpense = useCallback((expenseId: string) => {
    onDeleteExpense(expenseId);
    setDeleteConfirm(null);
  }, [onDeleteExpense]);

  const handleToggleCategory = useCallback((categoryId: string) => {
    setExpandedCategory(prev => prev === categoryId ? null : categoryId);
  }, []);

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* =================== Budget Overview Card =================== */}
      <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className={`p-2 rounded-lg ${
              isOverBudget
                ? 'bg-[var(--danger)]/10 dark:bg-[var(--danger)]/20'
                : 'bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20'
            }`}>
              <DollarSign className={`w-4 h-4 ${
                isOverBudget
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--brand-blue)] dark:text-[var(--brand-sky)]'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
                Budget Overview
              </h3>
              <p className="text-xs text-[var(--text-muted)] dark:text-white/50">
                FY {budget.fiscal_year} &middot; {budget.currency}
              </p>
            </div>
            {/* Warning badges */}
            {isOverBudget && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--danger)]/10 text-[var(--danger)]">
                <AlertTriangle className="w-3 h-3" />
                Over Budget
              </span>
            )}
            {isWarning && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--warning)]/10 text-[var(--warning)]">
                <AlertTriangle className="w-3 h-3" />
                {spentPercentage}% Spent
              </span>
            )}
          </div>

          {/* Main budget figures */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-[var(--text-muted)] dark:text-white/50 mb-0.5">Total Budget</p>
              <p className="text-xl font-bold text-[var(--foreground)] dark:text-white tracking-tight">
                {formatCurrency(budget.total_budget, budget.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] dark:text-white/50 mb-0.5">Spent</p>
              <p className={`text-xl font-bold tracking-tight ${
                isOverBudget ? 'text-[var(--danger)]' : 'text-[var(--foreground)] dark:text-white'
              }`}>
                {formatCurrency(totalSpent, budget.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] dark:text-white/50 mb-0.5">Remaining</p>
              <p className={`text-xl font-bold tracking-tight ${
                isOverBudget
                  ? 'text-[var(--danger)]'
                  : remaining < budget.total_budget * 0.1
                    ? 'text-[var(--warning)]'
                    : 'text-[var(--success)]'
              }`}>
                {formatCurrency(remaining, budget.currency)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-3 rounded-full overflow-hidden bg-[var(--surface-3)] dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverBudget
                    ? 'bg-[var(--danger)]'
                    : isWarning
                      ? 'bg-gradient-to-r from-[var(--warning)] to-[var(--danger)]'
                      : 'bg-gradient-to-r from-[var(--brand-blue)] to-[var(--success)]'
                }`}
                style={{ width: `${Math.min(spentPercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-[var(--text-muted)] dark:text-white/40">
                {spentPercentage}% spent
              </span>
              <span className="text-xs text-[var(--text-muted)] dark:text-white/40">
                {formatCurrency(totalAllocated, budget.currency)} allocated
              </span>
            </div>
          </div>

          {/* Burn rate indicator */}
          {burnRate && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              burnRate.projectedOverspend
                ? 'bg-[var(--danger)]/5 text-[var(--danger)] border border-[var(--danger)]/10'
                : 'bg-[var(--surface)] dark:bg-white/5 text-[var(--text-muted)] dark:text-white/50'
            }`}>
              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Burn rate: {formatCurrency(burnRate.monthlyRate, budget.currency)}/mo
                {burnRate.remainingMonths > 0 && (
                  <> &middot; {burnRate.remainingMonths} months remaining in FY</>
                )}
                {burnRate.projectedOverspend && (
                  <span className="font-medium"> &mdash; projected to exceed budget</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* =================== Category Breakdown =================== */}
      <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
              <BarChart3 className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
            </div>
            <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
              Category Breakdown
            </h3>
          </div>

          {/* Stacked bar showing total allocation */}
          <div className="mb-4">
            <div className="h-4 rounded-full overflow-hidden flex bg-[var(--surface-3)] dark:bg-white/10">
              {budget.categories
                .filter(c => c.allocated > 0)
                .map((cat) => {
                  const pct = totalAllocated > 0 ? (cat.allocated / totalAllocated) * 100 : 0;
                  return (
                    <div
                      key={cat.id}
                      className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:opacity-80 cursor-pointer"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      title={`${cat.name}: ${formatCurrency(cat.allocated, budget.currency)} (${Math.round(pct)}%)`}
                      onClick={() => handleToggleCategory(cat.id)}
                    />
                  );
                })}
            </div>
          </div>

          {/* Category rows */}
          <div className="space-y-2">
            {budget.categories.map((cat) => {
              const catRemaining = cat.allocated - cat.spent;
              const catPct = cat.allocated > 0 ? Math.round((cat.spent / cat.allocated) * 100) : 0;
              const catOverBudget = cat.spent > cat.allocated;
              const isExpanded = expandedCategory === cat.id;
              const categoryExpenses = budget.expenses.filter(e => e.category_id === cat.id);

              return (
                <div key={cat.id}>
                  <button
                    onClick={() => handleToggleCategory(cat.id)}
                    className="w-full text-left"
                  >
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isExpanded
                        ? 'bg-[var(--surface)] dark:bg-white/5'
                        : 'hover:bg-[var(--surface)] dark:hover:bg-white/5'
                    }`}>
                      {/* Color dot + name */}
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-sm font-medium text-[var(--foreground)] dark:text-white flex-1 truncate">
                        {cat.name}
                      </span>

                      {/* Amounts */}
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-[var(--text-muted)] dark:text-white/50">
                          {formatCurrency(cat.spent, budget.currency)}
                          <span className="text-[var(--text-muted)] dark:text-white/30"> / </span>
                          {formatCurrency(cat.allocated, budget.currency)}
                        </span>
                        <span className={`font-medium min-w-[3rem] text-right ${
                          catOverBudget ? 'text-[var(--danger)]'
                            : catPct >= 80 ? 'text-[var(--warning)]'
                            : 'text-[var(--text-muted)] dark:text-white/50'
                        }`}>
                          {catPct}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-20 h-1.5 rounded-full overflow-hidden bg-[var(--surface-3)] dark:bg-white/10 flex-shrink-0">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(catPct, 100)}%`,
                            backgroundColor: catOverBudget ? 'var(--danger)' : cat.color,
                          }}
                        />
                      </div>

                      {/* Expand arrow */}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[var(--text-muted)] dark:text-white/40 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)] dark:text-white/40 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Expanded expense list for this category */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 dark:border-white/10" style={{ borderColor: cat.color + '40' }}>
                      {categoryExpenses.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] dark:text-white/40 py-2 px-2">
                          No expenses recorded in this category
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {categoryExpenses
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((expense) => (
                            <div
                              key={expense.id}
                              className="flex items-center gap-3 px-2 py-1.5 rounded text-xs hover:bg-[var(--surface)] dark:hover:bg-white/5"
                            >
                              <span className="text-[var(--text-muted)] dark:text-white/40 w-16 flex-shrink-0">
                                {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-[var(--foreground)] dark:text-white flex-1 truncate">
                                {expense.description}
                              </span>
                              <span className="font-medium text-[var(--foreground)] dark:text-white flex-shrink-0">
                                {formatCurrencyPrecise(expense.amount, budget.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between px-2 pt-1.5 mt-1 border-t border-[var(--border)] dark:border-white/10">
                        <span className="text-xs text-[var(--text-muted)] dark:text-white/40">
                          Remaining
                        </span>
                        <span className={`text-xs font-medium ${
                          catOverBudget ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                        }`}>
                          {formatCurrency(catRemaining, budget.currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================== Expense Table =================== */}
      <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
                <Receipt className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
                  Expenses
                </h3>
                <p className="text-xs text-[var(--text-muted)] dark:text-white/50">
                  {filteredExpenses.length} record{filteredExpenses.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Category filter */}
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] dark:text-white/40" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg text-xs
                    bg-[var(--surface)] dark:bg-[var(--surface-3)]
                    border border-[var(--border)] dark:border-white/10
                    text-[var(--foreground)] dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                    appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {budget.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Add expense button */}
              {!readOnly && (
                <button
                  onClick={() => setShowAddExpense(!showAddExpense)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    text-[var(--brand-blue)] dark:text-[var(--brand-sky)]
                    bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20
                    hover:bg-[var(--brand-blue)]/20 dark:hover:bg-[var(--brand-sky)]/30
                    transition-colors"
                >
                  {showAddExpense ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAddExpense ? 'Cancel' : 'Add Expense'}
                </button>
              )}
            </div>
          </div>

          {/* Add expense inline form */}
          {showAddExpense && !readOnly && (
            <div className="mb-4 p-4 rounded-lg bg-[var(--surface)] dark:bg-[var(--surface-3)] border border-[var(--border)] dark:border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Expense description..."
                    className="w-full px-3 py-2 rounded-lg text-sm
                      bg-white dark:bg-[var(--surface-2)]
                      border border-[var(--border)] dark:border-white/10
                      text-[var(--foreground)] dark:text-white
                      placeholder-[var(--text-muted)] dark:placeholder-white/40
                      focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1">
                    Amount ({budget.currency})
                  </label>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg text-sm
                      bg-white dark:bg-[var(--surface-2)]
                      border border-[var(--border)] dark:border-white/10
                      text-[var(--foreground)] dark:text-white
                      placeholder-[var(--text-muted)] dark:placeholder-white/40
                      focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1">
                    Category
                  </label>
                  <select
                    value={newExpense.category_id}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm
                      bg-white dark:bg-[var(--surface-2)]
                      border border-[var(--border)] dark:border-white/10
                      text-[var(--foreground)] dark:text-white
                      focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                      appearance-none cursor-pointer"
                  >
                    <option value="">Select category...</option>
                    {budget.categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm
                      bg-white dark:bg-[var(--surface-2)]
                      border border-[var(--border)] dark:border-white/10
                      text-[var(--foreground)] dark:text-white
                      focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1">
                    Created By
                  </label>
                  <input
                    type="text"
                    value={newExpense.created_by}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, created_by: e.target.value }))}
                    placeholder="Your name..."
                    className="w-full px-3 py-2 rounded-lg text-sm
                      bg-white dark:bg-[var(--surface-2)]
                      border border-[var(--border)] dark:border-white/10
                      text-[var(--foreground)] dark:text-white
                      placeholder-[var(--text-muted)] dark:placeholder-white/40
                      focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddExpense}
                    disabled={
                      !newExpense.description.trim() ||
                      !newExpense.amount ||
                      parseFloat(newExpense.amount) <= 0 ||
                      !newExpense.category_id ||
                      !newExpense.created_by.trim()
                    }
                    className="w-full px-4 py-2 text-sm font-medium rounded-lg
                      bg-[var(--brand-blue)] text-white
                      hover:bg-[var(--brand-navy)]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors"
                  >
                    Add Expense
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] dark:border-white/10">
                  {[
                    { field: 'date' as SortField, label: 'Date' },
                    { field: 'description' as SortField, label: 'Description' },
                    { field: 'category' as SortField, label: 'Category' },
                    { field: 'amount' as SortField, label: 'Amount' },
                    { field: 'created_by' as SortField, label: 'Created By' },
                  ].map(col => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className="text-left text-xs font-medium text-[var(--text-muted)] dark:text-white/50 px-3 py-2 cursor-pointer hover:text-[var(--foreground)] dark:hover:text-white transition-colors select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className={`w-3 h-3 ${
                          sortField === col.field
                            ? 'text-[var(--brand-blue)] dark:text-[var(--brand-sky)]'
                            : 'opacity-30'
                        }`} />
                      </span>
                    </th>
                  ))}
                  {!readOnly && (
                    <th className="w-10 px-3 py-2" />
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} className="text-center py-8">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] dark:text-white/30" />
                      <p className="text-sm text-[var(--text-muted)] dark:text-white/50">
                        No expenses recorded
                      </p>
                      <p className="text-xs text-[var(--text-muted)] dark:text-white/30 mt-1">
                        {!readOnly ? 'Click "Add Expense" to record spending' : 'No spending data available'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-[var(--border)] dark:border-white/5 hover:bg-[var(--surface)] dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[var(--text-muted)] dark:text-white/50 whitespace-nowrap">
                        {new Date(expense.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--foreground)] dark:text-white">
                        {expense.description}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: getCategoryColor(expense.category_id) }}
                          />
                          <span className="text-[var(--text-muted)] dark:text-white/60 text-xs">
                            {getCategoryName(expense.category_id)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[var(--foreground)] dark:text-white whitespace-nowrap">
                        {formatCurrencyPrecise(expense.amount, budget.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)] dark:text-white/50 text-xs">
                        {expense.created_by}
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-2.5">
                          {deleteConfirm === expense.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="px-2 py-0.5 text-xs font-medium rounded bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] dark:hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(expense.id)}
                              className="p-1 rounded hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                              aria-label={`Delete expense: ${expense.description}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =================== Budget Summary (Donut + Monthly Trend) =================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
                <PieChart className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
              </div>
              <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
                Allocation by Category
              </h3>
            </div>

            <div className="flex flex-col items-center">
              <DonutChart segments={donutSegments} size={180} />

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
                {budget.categories
                  .filter(c => c.allocated > 0)
                  .map(cat => (
                    <div key={cat.id} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs text-[var(--text-muted)] dark:text-white/50">
                        {cat.name}
                      </span>
                      <span className="text-xs font-medium text-[var(--foreground)] dark:text-white/70">
                        {totalAllocated > 0 ? Math.round((cat.allocated / totalAllocated) * 100) : 0}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Spending Trend */}
        <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
                <Calendar className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
              </div>
              <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
                Monthly Spending Trend
              </h3>
            </div>

            <MonthlyBarChart data={monthlyData} currency={budget.currency} />

            {/* Summary below chart */}
            {burnRate && (
              <div className="mt-4 pt-3 border-t border-[var(--border)] dark:border-white/10">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)] dark:text-white/50">
                    Avg. monthly spend
                  </span>
                  <span className="font-medium text-[var(--foreground)] dark:text-white">
                    {formatCurrency(burnRate.monthlyRate, budget.currency)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget notes */}
      {budget.notes && (
        <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm p-5">
          <h4 className="text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-2 uppercase tracking-wider">
            Budget Notes
          </h4>
          <p className="text-sm text-[var(--foreground)] dark:text-white whitespace-pre-wrap">
            {budget.notes}
          </p>
        </div>
      )}
    </div>
  );
}
