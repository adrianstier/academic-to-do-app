/**
 * TodoStatsCards Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TodoStatsCards from '@/components/todo/TodoStatsCards';

describe('TodoStatsCards', () => {
  const defaultProps = {
    stats: {
      active: 10,
      completed: 5,
      dueToday: 3,
      overdue: 2,
    },
    quickFilter: 'all' as const,
    showCompleted: false,
    setQuickFilter: vi.fn(),
    setShowCompleted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all stats cards', () => {
    render(<TodoStatsCards {...defaultProps} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Due Today')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('should highlight active card when quickFilter is all', () => {
    render(<TodoStatsCards {...defaultProps} />);

    const todoCard = screen.getByRole('button', { name: /10/ });
    expect(todoCard).toHaveClass('ring-2');
  });

  it('should call setQuickFilter with "all" when clicking To Do card', () => {
    render(<TodoStatsCards {...defaultProps} />);

    const todoCard = screen.getByText('To Do').closest('button');
    fireEvent.click(todoCard!);

    expect(defaultProps.setQuickFilter).toHaveBeenCalledWith('all');
    expect(defaultProps.setShowCompleted).toHaveBeenCalledWith(false);
  });

  it('should call setQuickFilter with "due_today" when clicking Due Today card', () => {
    render(<TodoStatsCards {...defaultProps} />);

    const dueTodayCard = screen.getByText('Due Today').closest('button');
    fireEvent.click(dueTodayCard!);

    expect(defaultProps.setQuickFilter).toHaveBeenCalledWith('due_today');
  });

  it('should call setQuickFilter with "overdue" when clicking Overdue card', () => {
    render(<TodoStatsCards {...defaultProps} />);

    const overdueCard = screen.getByText('Overdue').closest('button');
    fireEvent.click(overdueCard!);

    expect(defaultProps.setQuickFilter).toHaveBeenCalledWith('overdue');
  });

  it('should highlight Due Today card when quickFilter is due_today', () => {
    render(<TodoStatsCards {...defaultProps} quickFilter="due_today" />);

    const dueTodayCard = screen.getByText('Due Today').closest('button');
    expect(dueTodayCard).toHaveClass('ring-2');
  });

  it('should highlight Overdue card when quickFilter is overdue', () => {
    render(<TodoStatsCards {...defaultProps} quickFilter="overdue" />);

    const overdueCard = screen.getByText('Overdue').closest('button');
    expect(overdueCard).toHaveClass('ring-2');
  });

  it('should show zero values correctly', () => {
    render(
      <TodoStatsCards
        {...defaultProps}
        stats={{
          active: 0,
          completed: 0,
          dueToday: 0,
          overdue: 0,
        }}
      />
    );

    // Should show 0 for all counts
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(3); // To Do, Due Today, Overdue
  });

  it('should apply success color when overdue is 0', () => {
    render(
      <TodoStatsCards
        {...defaultProps}
        stats={{
          ...defaultProps.stats,
          overdue: 0,
        }}
      />
    );

    const overdueValue = screen.getByText('0');
    expect(overdueValue).toHaveClass('text-[var(--success)]');
  });

  it('should apply danger color when overdue > 0', () => {
    render(<TodoStatsCards {...defaultProps} />);

    const overdueValue = screen.getByText('2'); // overdue count
    expect(overdueValue).toHaveClass('text-[var(--danger)]');
  });
});
