'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  FileDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { ProjectBudget, BudgetCategory } from '@/types/budget';
import { DEFAULT_BUDGET_CATEGORIES, BUDGET_TEMPLATES } from '@/types/budget';

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

// =====================================================================
// Props
// =====================================================================

interface BudgetSetupFormProps {
  projectId: string;
  existingBudget?: ProjectBudget | null;
  onSave: (budget: ProjectBudget) => void;
  onCancel?: () => void;
}

// =====================================================================
// Color Palette
// =====================================================================

const CATEGORY_COLORS = [
  '#3B82F6', '#2563EB', '#60A5FA',
  '#8B5CF6', '#A855F7', '#6366F1',
  '#10B981', '#059669', '#14B8A6',
  '#F59E0B', '#EAB308', '#F97316',
  '#EC4899', '#EF4444', '#64748B',
  '#94A3B8', '#84CC16', '#06B6D4',
];

// =====================================================================
// Generate unique ID
// =====================================================================

function generateId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// =====================================================================
// Main Component
// =====================================================================

export default function BudgetSetupForm({
  projectId,
  existingBudget,
  onSave,
  onCancel,
}: BudgetSetupFormProps) {
  // --- State ---
  const currentYear = new Date().getFullYear();

  const [totalBudget, setTotalBudget] = useState<string>(
    existingBudget ? existingBudget.total_budget.toString() : ''
  );
  const [currency, setCurrency] = useState(existingBudget?.currency || 'USD');
  const [fiscalYear, setFiscalYear] = useState(
    existingBudget?.fiscal_year || currentYear.toString()
  );
  const [notes, setNotes] = useState(existingBudget?.notes || '');
  const [categories, setCategories] = useState<BudgetCategory[]>(
    existingBudget?.categories ||
    DEFAULT_BUDGET_CATEGORIES.map(c => ({
      ...c,
      id: generateId(),
      allocated: 0,
      spent: 0,
    }))
  );
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);

  // --- Derived Data ---
  const totalBudgetNum = parseFloat(totalBudget) || 0;
  const totalAllocated = useMemo(
    () => categories.reduce((sum, c) => sum + c.allocated, 0),
    [categories]
  );
  const allocationRemaining = totalBudgetNum - totalAllocated;
  const isOverAllocated = totalAllocated > totalBudgetNum && totalBudgetNum > 0;

  const isValid = useMemo(() => {
    return (
      totalBudgetNum > 0 &&
      categories.length > 0 &&
      !isOverAllocated &&
      categories.every(c => c.name.trim().length > 0)
    );
  }, [totalBudgetNum, categories, isOverAllocated]);

  // --- Handlers ---
  const handleAddCategory = useCallback(() => {
    // Pick a color not already in use
    const usedColors = new Set(categories.map(c => c.color));
    const availableColor = CATEGORY_COLORS.find(c => !usedColors.has(c)) || CATEGORY_COLORS[0];

    setCategories(prev => [
      ...prev,
      {
        id: generateId(),
        name: '',
        allocated: 0,
        spent: 0,
        color: availableColor,
      },
    ]);
  }, [categories]);

  const handleRemoveCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleUpdateCategory = useCallback((id: string, field: keyof BudgetCategory, value: string | number) => {
    setCategories(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        if (field === 'allocated') {
          const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
          return { ...c, allocated: Math.max(0, num) };
        }
        return { ...c, [field]: value };
      })
    );
  }, []);

  const handleImportTemplate = useCallback((templateId: string) => {
    const template = BUDGET_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setCategories(
      template.categories.map(c => ({
        ...c,
        id: generateId(),
        allocated: 0,
        spent: 0,
      }))
    );
    setShowTemplateMenu(false);
  }, []);

  const handleDistributeEvenly = useCallback(() => {
    if (categories.length === 0 || totalBudgetNum <= 0) return;
    const perCategory = Math.floor(totalBudgetNum / categories.length);
    const remainder = Math.round(totalBudgetNum - perCategory * categories.length);

    setCategories(prev =>
      prev.map((c, i) => ({
        ...c,
        allocated: perCategory + (i < remainder ? 1 : 0),
      }))
    );
  }, [categories.length, totalBudgetNum]);

  // Reason the form can't be saved, if any
  const invalidReason = useMemo(() => {
    if (totalBudgetNum <= 0) return 'Enter a total budget amount greater than zero.';
    if (categories.length === 0) return 'Add at least one budget category.';
    if (isOverAllocated) return 'Category allocations exceed the total budget.';
    if (categories.some(c => !c.name.trim())) return 'All categories must have a name.';
    return null;
  }, [totalBudgetNum, categories, isOverAllocated]);

  const handleSave = useCallback(() => {
    if (!isValid) return;

    const existingExpenses = existingBudget?.expenses || [];

    // Recalculate spent amounts from existing expenses to keep data consistent
    const spentByCategory: Record<string, number> = {};
    for (const expense of existingExpenses) {
      spentByCategory[expense.category_id] = (spentByCategory[expense.category_id] || 0) + expense.amount;
    }

    const categoriesWithSpent = categories.map(cat => ({
      ...cat,
      spent: spentByCategory[cat.id] || cat.spent || 0,
    }));

    const budget: ProjectBudget = {
      project_id: projectId,
      total_budget: totalBudgetNum,
      currency,
      fiscal_year: fiscalYear,
      categories: categoriesWithSpent,
      expenses: existingExpenses,
      notes: notes.trim() || undefined,
    };

    onSave(budget);
  }, [isValid, projectId, totalBudgetNum, currency, fiscalYear, categories, existingBudget, notes, onSave]);

  // --- Fiscal year options ---
  const fiscalYearOptions = useMemo(() => {
    const years: string[] = [];
    for (let y = currentYear - 2; y <= currentYear + 5; y++) {
      years.push(y.toString());
    }
    return years;
  }, [currentYear]);

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* =================== Header =================== */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
          <DollarSign className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
            {existingBudget ? 'Edit Budget' : 'Set Up Budget'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] dark:text-white/50">
            Configure grant budget categories and allocations
          </p>
        </div>
      </div>

      {/* =================== Budget Basics =================== */}
      <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm p-5">
        <h4 className="text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-3 uppercase tracking-wider">
          Budget Details
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Budget */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1.5">
              Total Budget
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] dark:text-white/40" />
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => {
                  const val = e.target.value;
                  // Prevent negative values
                  if (val === '' || parseFloat(val) >= 0) {
                    setTotalBudget(val);
                  }
                }}
                placeholder="0"
                min="0"
                step="1000"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium
                  bg-[var(--surface)] dark:bg-[var(--surface-3)]
                  border border-[var(--border)] dark:border-white/10
                  text-[var(--foreground)] dark:text-white
                  placeholder-[var(--text-muted)] dark:placeholder-white/40
                  focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30 focus:border-[var(--brand-blue)]"
              />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm
                bg-[var(--surface)] dark:bg-[var(--surface-3)]
                border border-[var(--border)] dark:border-white/10
                text-[var(--foreground)] dark:text-white
                focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                appearance-none cursor-pointer"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
              <option value="CHF">CHF - Swiss Franc</option>
            </select>
          </div>

          {/* Fiscal Year */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1.5">
              Fiscal Year
            </label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm
                bg-[var(--surface)] dark:bg-[var(--surface-3)]
                border border-[var(--border)] dark:border-white/10
                text-[var(--foreground)] dark:text-white
                focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                appearance-none cursor-pointer"
            >
              {fiscalYearOptions.map(yr => (
                <option key={yr} value={yr}>FY {yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-[var(--text-muted)] dark:text-white/50 mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional budget notes, restrictions, or guidelines..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none
              bg-[var(--surface)] dark:bg-[var(--surface-3)]
              border border-[var(--border)] dark:border-white/10
              text-[var(--foreground)] dark:text-white
              placeholder-[var(--text-muted)] dark:placeholder-white/40
              focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
          />
        </div>
      </div>

      {/* =================== Category Allocations =================== */}
      <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] dark:text-white/50 uppercase tracking-wider">
              Category Allocations
            </h4>
            {totalBudgetNum > 0 && (
              <p className="text-xs text-[var(--text-muted)] dark:text-white/40 mt-0.5">
                {formatCurrency(totalAllocated, currency)} of {formatCurrency(totalBudgetNum, currency)} allocated
                {allocationRemaining > 0 && (
                  <span className="text-[var(--success)] ml-1">
                    ({formatCurrency(allocationRemaining, currency)} remaining)
                  </span>
                )}
                {isOverAllocated && (
                  <span className="text-[var(--danger)] ml-1">
                    (over-allocated by {formatCurrency(Math.abs(allocationRemaining), currency)})
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Import from template */}
            <div className="relative">
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  text-[var(--text-muted)] dark:text-white/50
                  bg-[var(--surface)] dark:bg-[var(--surface-3)]
                  hover:bg-[var(--surface-2)] dark:hover:bg-white/10
                  border border-[var(--border)] dark:border-white/10
                  transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                Import Template
              </button>

              {showTemplateMenu && (
                <>
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowTemplateMenu(false)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowTemplateMenu(false); }}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg shadow-lg
                    bg-white dark:bg-[var(--surface-3)]
                    border border-[var(--border)] dark:border-white/10
                    overflow-hidden"
                  >
                    {BUDGET_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleImportTemplate(template.id)}
                        className="w-full text-left px-4 py-3 hover:bg-[var(--surface)] dark:hover:bg-white/5 transition-colors"
                      >
                        <p className="text-sm font-medium text-[var(--foreground)] dark:text-white">
                          {template.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] dark:text-white/40 mt-0.5">
                          {template.description}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] dark:text-white/30 mt-0.5">
                          {template.categories.length} categories
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Distribute evenly */}
            {totalBudgetNum > 0 && categories.length > 0 && (
              <button
                onClick={handleDistributeEvenly}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  text-[var(--text-muted)] dark:text-white/50
                  bg-[var(--surface)] dark:bg-[var(--surface-3)]
                  hover:bg-[var(--surface-2)] dark:hover:bg-white/10
                  border border-[var(--border)] dark:border-white/10
                  transition-colors"
                title="Distribute total budget evenly across all categories"
              >
                Distribute Evenly
              </button>
            )}

            {/* Add category */}
            <button
              onClick={handleAddCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                text-[var(--brand-blue)] dark:text-[var(--brand-sky)]
                bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20
                hover:bg-[var(--brand-blue)]/20 dark:hover:bg-[var(--brand-sky)]/30
                transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          </div>
        </div>

        {/* Allocation progress bar */}
        {totalBudgetNum > 0 && (
          <div className="mb-4">
            <div className="h-2.5 rounded-full overflow-hidden flex bg-[var(--surface-3)] dark:bg-white/10">
              {categories
                .filter(c => c.allocated > 0)
                .map((cat) => {
                  // Use max of totalAllocated and totalBudgetNum so bar doesn't overflow when over-allocated
                  const base = Math.max(totalAllocated, totalBudgetNum);
                  const pct = (cat.allocated / base) * 100;
                  return (
                    <div
                      key={cat.id}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cat.color }}
                      title={`${cat.name}: ${formatCurrency(cat.allocated, currency)}`}
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Category rows */}
        {categories.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] dark:text-white/30" />
            <p className="text-sm text-[var(--text-muted)] dark:text-white/50">
              No categories defined
            </p>
            <p className="text-xs text-[var(--text-muted)] dark:text-white/30 mt-1">
              Add categories or import from a template
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat, index) => {
              const allocationPct = totalBudgetNum > 0
                ? Math.round((cat.allocated / totalBudgetNum) * 100)
                : 0;

              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--surface)] dark:bg-[var(--surface-3)] border border-[var(--border)] dark:border-white/10"
                >
                  {/* Color selector */}
                  <div className="relative">
                    <button
                      onClick={() => setEditingColorId(editingColorId === cat.id ? null : cat.id)}
                      className="w-6 h-6 rounded flex-shrink-0 border-2 border-white dark:border-white/20 shadow-sm transition-transform hover:scale-110"
                      style={{ backgroundColor: cat.color }}
                      aria-label={`Change color for ${cat.name || 'category'}`}
                    />
                    {editingColorId === cat.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setEditingColorId(null)}
                        />
                        <div className="absolute left-0 top-full mt-1 z-20 p-2 rounded-lg shadow-lg
                          bg-white dark:bg-[var(--surface-2)]
                          border border-[var(--border)] dark:border-white/10"
                        >
                          <div className="grid grid-cols-6 gap-1">
                            {CATEGORY_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  handleUpdateCategory(cat.id, 'color', color);
                                  setEditingColorId(null);
                                }}
                                className={`w-6 h-6 rounded transition-transform hover:scale-110 ${
                                  cat.color === color ? 'ring-2 ring-[var(--brand-blue)] ring-offset-1' : ''
                                }`}
                                style={{ backgroundColor: color }}
                                aria-label={`Select color ${color}`}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Category name */}
                  <input
                    type="text"
                    value={cat.name}
                    onChange={(e) => handleUpdateCategory(cat.id, 'name', e.target.value)}
                    placeholder="Category name..."
                    className="flex-1 min-w-0 px-2 py-1 rounded text-sm font-medium
                      bg-transparent
                      text-[var(--foreground)] dark:text-white
                      placeholder-[var(--text-muted)] dark:placeholder-white/40
                      focus:outline-none focus:bg-white dark:focus:bg-[var(--surface-2)]
                      border border-transparent focus:border-[var(--border)] dark:focus:border-white/10"
                  />

                  {/* Allocation amount */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] dark:text-white/40" />
                      <input
                        type="number"
                        value={cat.allocated || ''}
                        onChange={(e) => handleUpdateCategory(cat.id, 'allocated', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="100"
                        className="w-28 pl-7 pr-2 py-1 rounded text-sm text-right
                          bg-white dark:bg-[var(--surface-2)]
                          border border-[var(--border)] dark:border-white/10
                          text-[var(--foreground)] dark:text-white
                          placeholder-[var(--text-muted)] dark:placeholder-white/40
                          focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                      />
                    </div>

                    {/* Percentage indicator */}
                    <span className={`text-xs w-10 text-right flex-shrink-0 ${
                      totalBudgetNum > 0
                        ? 'text-[var(--text-muted)] dark:text-white/50'
                        : 'text-transparent'
                    }`}>
                      {allocationPct}%
                    </span>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="p-1 rounded hover:bg-[var(--danger)]/10 text-[var(--text-muted)] dark:text-white/30 hover:text-[var(--danger)] transition-colors flex-shrink-0"
                      aria-label={`Remove ${cat.name || 'category'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =================== Validation + Actions =================== */}
      <div className="flex items-center justify-between">
        <div>
          {/* Validation messages */}
          {isOverAllocated && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
              <AlertTriangle className="w-3.5 h-3.5" />
              Category allocations exceed total budget by {formatCurrency(Math.abs(allocationRemaining), currency)}
            </div>
          )}
          {!isOverAllocated && allocationRemaining > 0.01 && totalBudgetNum > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--warning)]">
              <AlertTriangle className="w-3.5 h-3.5" />
              {formatCurrency(allocationRemaining, currency)} unallocated
            </div>
          )}
          {!isOverAllocated && Math.abs(allocationRemaining) < 0.01 && totalBudgetNum > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Budget fully allocated
            </div>
          )}
          {!isValid && invalidReason && !isOverAllocated && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <AlertTriangle className="w-3.5 h-3.5" />
              {invalidReason}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium
                text-[var(--text-muted)] dark:text-white/50
                hover:bg-[var(--surface)] dark:hover:bg-white/10
                transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-5 py-2 rounded-lg text-sm font-medium
              bg-[var(--brand-blue)] text-white
              hover:bg-[var(--brand-navy)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all shadow-lg shadow-[var(--brand-blue)]/20"
          >
            {existingBudget ? 'Update Budget' : 'Create Budget'}
          </button>
        </div>
      </div>
    </div>
  );
}
