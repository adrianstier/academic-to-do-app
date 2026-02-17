/**
 * Comprehensive Test Suite for Dashboard Components
 *
 * Tests cover:
 * - Role-based rendering (Doer vs Manager)
 * - Data filtering (personal vs team tasks)
 * - Visual polish and animations
 * - Interactive elements and navigation
 * - Edge cases and empty states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DashboardPage from '@/components/views/DashboardPage';
import DoerDashboard from '@/components/dashboard/DoerDashboard';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import { Todo, AuthUser } from '@/types/todo';

// Mock the theme context
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

// Mock the AppShell context
vi.mock('@/components/layout', () => ({
  useAppShell: () => ({
    setActiveView: vi.fn(),
  }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Helper to create mock user
const createMockUser = (name: string): AuthUser => ({
  id: `user-${name.toLowerCase().replace(' ', '-')}`,
  name,
  email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
  color: '#3B82F6',
  role: 'admin',
  created_at: new Date().toISOString(),
});

// Helper to create mock todos
const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: `todo-${Math.random().toString(36).substr(2, 9)}`,
  text: 'Test task',
  completed: false,
  status: 'todo',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: overrides.assigned_to || 'Unknown',
  priority: 'medium',
  ...overrides,
});

// Get date helpers - use local date formatting to avoid timezone issues
const getToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextWeek = () => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 5);
  const year = nextWeek.getFullYear();
  const month = String(nextWeek.getMonth() + 1).padStart(2, '0');
  const day = String(nextWeek.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('DashboardPage', () => {
  const mockCurrentUser = createMockUser('John Doe');
  const mockOnNavigate = vi.fn();
  const mockOnFilterOverdue = vi.fn();
  const mockOnFilterDueToday = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Detection', () => {
    it('renders DoerDashboard when user has no team members', () => {
      const todos = [createMockTodo({ assigned_to: 'John Doe' })];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
          onNavigateToTasks={mockOnNavigate}
        />
      );

      // Doer dashboard should show personal focus sections
      expect(screen.getByText(/Your Day/i)).toBeInTheDocument();
      expect(screen.queryByText(/Team Health/i)).not.toBeInTheDocument();
    });

    it('renders ManagerDashboard when user has team members', () => {
      const todos = [createMockTodo({ assigned_to: 'John Doe' })];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe', 'Jane Smith', 'Bob Wilson']}
          onNavigateToTasks={mockOnNavigate}
        />
      );

      // Manager dashboard should show team sections
      expect(screen.getByText(/Team Health/i)).toBeInTheDocument();
    });

    it('shows team member count in header for managers', () => {
      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={[]}
          users={['John Doe', 'Jane Smith', 'Bob Wilson']}
        />
      );

      expect(screen.getByText(/3 team members/i)).toBeInTheDocument();
    });
  });

  describe('Header Stats', () => {
    it('displays overdue stat with correct styling when overdue exists', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'John Doe' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'John Doe' }),
      ];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
        />
      );

      // The overdue button should have red styling when there are overdue tasks
      const overdueButtons = screen.getAllByText('Overdue');
      const headerOverdue = overdueButtons[0].closest('button');
      expect(headerOverdue).toHaveClass('bg-red-500/20');
    });

    it('displays due today stat', () => {
      const todos = [
        createMockTodo({ due_date: getToday(), assigned_to: 'John Doe' }),
        createMockTodo({ due_date: getToday(), assigned_to: 'John Doe' }),
      ];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
        />
      );

      // Header should show "Due Today" label
      const dueTodayElements = screen.getAllByText('Due Today');
      expect(dueTodayElements.length).toBeGreaterThan(0);
    });

    it('displays upcoming week stat', () => {
      const todos = [
        createMockTodo({ due_date: getTomorrow(), assigned_to: 'John Doe' }),
        createMockTodo({ due_date: getNextWeek(), assigned_to: 'John Doe' }),
      ];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
        />
      );

      // Should show "Due This Week" label
      expect(screen.getByText('Due This Week')).toBeInTheDocument();
    });

    it('calls onFilterOverdue when overdue stat is clicked', () => {
      const todos = [createMockTodo({ due_date: getYesterday() })];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
          onFilterOverdue={mockOnFilterOverdue}
        />
      );

      const overdueButton = screen.getByText('Overdue').closest('button');
      fireEvent.click(overdueButton!);

      expect(mockOnFilterOverdue).toHaveBeenCalledTimes(1);
    });

    it('calls onFilterDueToday when due today stat is clicked', () => {
      const todos = [createMockTodo({ due_date: getToday() })];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
          onFilterDueToday={mockOnFilterDueToday}
        />
      );

      const dueTodayButton = screen.getByText('Due Today').closest('button');
      fireEvent.click(dueTodayButton!);

      expect(mockOnFilterDueToday).toHaveBeenCalledTimes(1);
    });
  });

  describe('Greeting', () => {
    it('displays user name in header', () => {
      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={[]}
          users={['John Doe']}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('displays active task count', () => {
      const todos = [
        createMockTodo({ completed: false }),
        createMockTodo({ completed: false }),
        createMockTodo({ completed: true }),
      ];

      render(
        <DashboardPage
          currentUser={mockCurrentUser}
          todos={todos}
          users={['John Doe']}
        />
      );

      expect(screen.getByText(/2 active tasks/i)).toBeInTheDocument();
    });
  });
});

describe('DoerDashboard', () => {
  const mockCurrentUser = createMockUser('John Doe');
  const mockOnNavigate = vi.fn();
  const mockOnFilterOverdue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Filtering - Personal Tasks Only', () => {
    it('filters out tasks assigned to other users', () => {
      const todos = [
        createMockTodo({ text: 'Johns overdue', assigned_to: 'John Doe', due_date: getYesterday() }),
        createMockTodo({ text: 'Janes task', assigned_to: 'Jane Smith', due_date: getYesterday() }),
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          onNavigateToTasks={mockOnNavigate}
        />
      );

      // John's task should trigger overdue alert (which shows task count)
      expect(screen.getByText(/1 task overdue/i)).toBeInTheDocument();
      // Jane's task count should not show (only John's 1 overdue, not 2)
    });

    it('includes unassigned tasks created by the current user', () => {
      const todos = [
        createMockTodo({
          text: 'Created task',
          created_by: 'John Doe',
          assigned_to: undefined,
          due_date: getYesterday()
        }),
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          onNavigateToTasks={mockOnNavigate}
        />
      );

      // Task should show up in overdue since it's from yesterday
      expect(screen.getByText(/1 task overdue/i)).toBeInTheDocument();
    });
  });

  describe('Overdue Alert', () => {
    it('shows prominent overdue alert when tasks are overdue', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'John Doe' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'John Doe' }),
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          onFilterOverdue={mockOnFilterOverdue}
        />
      );

      expect(screen.getByText(/2 tasks overdue/i)).toBeInTheDocument();
    });

    it('hides overdue alert when no tasks are overdue', () => {
      const todos = [createMockTodo({ due_date: getTomorrow(), assigned_to: 'John Doe' })];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
        />
      );

      expect(screen.queryByText(/tasks overdue/i)).not.toBeInTheDocument();
    });

    it('overdue alert is clickable and triggers navigation', () => {
      const todos = [createMockTodo({ due_date: getYesterday(), assigned_to: 'John Doe' })];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          onFilterOverdue={mockOnFilterOverdue}
        />
      );

      const overdueAlert = screen.getByText(/1 task overdue/i).closest('button');
      fireEvent.click(overdueAlert!);

      expect(mockOnFilterOverdue).toHaveBeenCalled();
    });
  });

  describe('Your Day Section', () => {
    it('shows Your Day section header', () => {
      // Create task with no due date (won't be overdue)
      const todos: Todo[] = [];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          onNavigateToTasks={mockOnNavigate}
        />
      );

      // Your Day section should always be present
      expect(screen.getByText('Your Day')).toBeInTheDocument();
    });

    it('shows positive empty state when no tasks due today', () => {
      // Create a todo with NO due date - won't be in any date-based section
      const todos = [
        createMockTodo({
          text: 'No deadline task',
          due_date: undefined,
          assigned_to: 'John Doe'
        })
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
        />
      );

      // Should show positive message since no tasks due today (task has no due date)
      expect(screen.getByText(/No tasks due today/i)).toBeInTheDocument();
    });

    it('shows upcoming section when future tasks exist', () => {
      // Use a date 3 days from now to ensure it's clearly in the "upcoming" range
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

      const todos = [
        createMockTodo({
          text: 'Next week task',
          due_date: futureDateStr,
          assigned_to: 'John Doe'
        }),
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
        />
      );

      expect(screen.getByText('Coming Up')).toBeInTheDocument();
      expect(screen.getByText('Next week task')).toBeInTheDocument();
    });
  });

  describe('Progress Section', () => {
    it('shows weekly completed count', () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 3);

      const todos = [
        createMockTodo({
          completed: true,
          updated_at: new Date().toISOString(),
          assigned_to: 'John Doe',
        }),
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
        />
      );

      expect(screen.getByText(/completed this week/i)).toBeInTheDocument();
    });

    it('shows progress bar', () => {
      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={[]}
        />
      );

      expect(screen.getByText(/weekly workload done/i)).toBeInTheDocument();
    });
  });

  describe('Priority Indicators', () => {
    it('displays tasks with urgent priority in overdue section', () => {
      const todos = [
        createMockTodo({
          text: 'Critical task',
          priority: 'urgent',
          due_date: getYesterday(),
          assigned_to: 'John Doe'
        }),
      ];

      render(
        <DoerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
        />
      );

      // The task should trigger overdue alert
      expect(screen.getByText(/1 task overdue/i)).toBeInTheDocument();
    });
  });
});

describe('ManagerDashboard', () => {
  const mockCurrentUser = createMockUser('Manager Mike');
  const mockUsers = ['Manager Mike', 'Alice Developer', 'Bob Designer', 'Carol Analyst'];
  const mockOnNavigate = vi.fn();
  const mockOnFilterOverdue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Team Health Overview', () => {
    it('displays team size', () => {
      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={[]}
          users={mockUsers}
        />
      );

      expect(screen.getByText('Team Size')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('displays total active tasks across team', () => {
      const todos = [
        createMockTodo({ assigned_to: 'Alice Developer' }),
        createMockTodo({ assigned_to: 'Bob Designer' }),
        createMockTodo({ assigned_to: 'Manager Mike' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    });

    it('displays team overdue count', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Alice Developer' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Bob Designer' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      expect(screen.getByText('Overdue')).toBeInTheDocument();
      // Should show 2 overdue in the team stats
    });
  });

  describe('Team Alert Banner', () => {
    it('shows team overdue alert when team has overdue tasks', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Alice Developer' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Bob Designer' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
          onFilterOverdue={mockOnFilterOverdue}
        />
      );

      expect(screen.getByText(/2 team tasks overdue/i)).toBeInTheDocument();
    });

    it('indicates how many overdue tasks belong to manager', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Manager Mike' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Alice Developer' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      expect(screen.getByText(/1 are yours/i)).toBeInTheDocument();
    });
  });

  describe('Needs Attention Section', () => {
    it('shows team members with overdue tasks', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Alice Developer' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Alice Developer' }),
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Alice Developer' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      // Alice should appear in needs attention
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      expect(screen.getByText('Alice Developer')).toBeInTheDocument();
      expect(screen.getByText(/3 overdue/i)).toBeInTheDocument();
    });

    it('shows overloaded team members', () => {
      // Create many tasks for one person to trigger overloaded status
      const todos = Array(15).fill(null).map((_, i) =>
        createMockTodo({ text: `Task ${i}`, assigned_to: 'Bob Designer' })
      );

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      // Bob should appear as overloaded
      expect(screen.getByText('Bob Designer')).toBeInTheDocument();
    });
  });

  describe('Team Workload Distribution', () => {
    it('shows workload bars for team members', () => {
      const todos = [
        createMockTodo({ assigned_to: 'Alice Developer' }),
        createMockTodo({ assigned_to: 'Alice Developer' }),
        createMockTodo({ assigned_to: 'Bob Designer' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      expect(screen.getByText('Team Workload')).toBeInTheDocument();
      // Should show Alice with 2 and Bob with 1
    });

    it('allows expanding to show all team members', () => {
      // Create users array with more than 5 members
      const manyUsers = [
        'Manager Mike', 'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={[]}
          users={manyUsers}
        />
      );

      // Should show "Show all X team members" button
      expect(screen.getByText(/Show all \d+ team members/i)).toBeInTheDocument();
    });
  });

  describe('Manager Personal Tasks', () => {
    it('shows Your Tasks section header', () => {
      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={[]}
          users={mockUsers}
        />
      );

      // Your Tasks section should always be present for managers
      expect(screen.getByText('Your Tasks')).toBeInTheDocument();
    });

    it('shows managers personal overdue notification when overdue tasks exist', () => {
      const todos = [
        createMockTodo({ due_date: getYesterday(), assigned_to: 'Manager Mike' }),
      ];

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      // Should show personal overdue notification
      expect(screen.getByText(/1 task overdue/i)).toBeInTheDocument();
    });
  });

  describe('Insurance Tasks Summary', () => {
    it('shows insurance task categories', () => {
      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={[]}
          users={mockUsers}
        />
      );

      expect(screen.getByText('Insurance Tasks')).toBeInTheDocument();
    });

    it('shows all tasks on track message when no insurance tasks', () => {
      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={[]}
          users={mockUsers}
        />
      );

      expect(screen.getByText(/All insurance tasks completed/i)).toBeInTheDocument();
    });
  });

  describe('Bottlenecks Section', () => {
    it('shows bottleneck warnings when issues exist', () => {
      // Create conditions for a bottleneck (overloaded member)
      const todos = Array(15).fill(null).map((_, i) =>
        createMockTodo({ text: `Task ${i}`, assigned_to: 'Alice Developer' })
      );

      render(
        <ManagerDashboard
          currentUser={mockCurrentUser}
          todos={todos}
          users={mockUsers}
        />
      );

      expect(screen.getByText('Bottlenecks')).toBeInTheDocument();
    });
  });
});

describe('Empty States', () => {
  const mockUser = createMockUser('Test User');

  it('DoerDashboard handles empty todo list gracefully', () => {
    render(
      <DoerDashboard
        currentUser={mockUser}
        todos={[]}
      />
    );

    expect(screen.getByText(/No tasks due today/i)).toBeInTheDocument();
    expect(screen.getByText('Your Day')).toBeInTheDocument();
  });

  it('ManagerDashboard handles empty todo list gracefully', () => {
    render(
      <ManagerDashboard
        currentUser={mockUser}
        todos={[]}
        users={['Test User', 'Other User']}
      />
    );

    expect(screen.getByText('Team Health')).toBeInTheDocument();
    expect(screen.getByText(/No tasks due today/i)).toBeInTheDocument();
  });
});

describe('Visual Polish', () => {
  const mockUser = createMockUser('Test User');

  it('DoerDashboard has correct section structure', () => {
    const todos = [
      createMockTodo({ due_date: getToday(), assigned_to: 'Test User' }),
    ];

    render(
      <DoerDashboard
        currentUser={mockUser}
        todos={todos}
      />
    );

    // Check for key sections
    expect(screen.getByText('Your Day')).toBeInTheDocument();
    expect(screen.getByText('Your Progress')).toBeInTheDocument();
  });

  it('ManagerDashboard has correct section structure', () => {
    render(
      <ManagerDashboard
        currentUser={mockUser}
        todos={[]}
        users={['Test User', 'Other User']}
      />
    );

    // Check for key sections
    expect(screen.getByText('Team Health')).toBeInTheDocument();
    expect(screen.getByText('Your Tasks')).toBeInTheDocument();
    expect(screen.getByText('Insurance Tasks')).toBeInTheDocument();
  });

  it('renders tasks in appropriate sections', () => {
    // Use tomorrow's date so tasks appear in "Coming Up", not as overdue
    const todos = [
      createMockTodo({ text: 'Future urgent', priority: 'urgent', due_date: getTomorrow(), assigned_to: 'Test User' }),
    ];

    render(
      <DoerDashboard
        currentUser={mockUser}
        todos={todos}
      />
    );

    // Task should render in the Coming Up section
    expect(screen.getByText('Future urgent')).toBeInTheDocument();
  });
});

describe('Accessibility', () => {
  const mockUser = createMockUser('Test User');

  it('task items are interactive elements', () => {
    // Use a future date (3 days out) to ensure task appears in "Coming Up" section
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

    const todos = [
      createMockTodo({ text: 'Clickable item', due_date: futureDateStr, assigned_to: 'Test User' }),
    ];

    render(
      <DoerDashboard
        currentUser={mockUser}
        todos={todos}
      />
    );

    // Task items should be in the document and clickable (in Coming Up section)
    const taskElement = screen.getByText('Clickable item');
    expect(taskElement).toBeInTheDocument();
    // The task should be clickable (inside a button)
    expect(taskElement.closest('button')).not.toBeNull();
  });

  it('sections have appropriate headings', () => {
    render(
      <DoerDashboard
        currentUser={mockUser}
        todos={[]}
      />
    );

    // Section titles should be present
    expect(screen.getByText('Your Day')).toBeInTheDocument();
    expect(screen.getByText('Your Progress')).toBeInTheDocument();
  });
});
