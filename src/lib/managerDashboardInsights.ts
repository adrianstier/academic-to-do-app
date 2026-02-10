/**
 * Manager Dashboard Insights
 *
 * Provides team-level analytics, workload distribution, delegation tracking,
 * and bottleneck detection for team leads/PIs.
 */

import { Todo, TodoPriority, ActivityLogEntry } from '@/types/todo';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamMemberStats {
  name: string;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  highPriorityTasks: number;
  completionRate: number;
  avgDaysToComplete: number;
  weeklyCompleted: number;
  workloadLevel: 'light' | 'normal' | 'heavy' | 'overloaded';
}

export interface DelegationStats {
  totalDelegated: number;
  pendingDelegated: number;
  completedDelegated: number;
  overdueDelegated: number;
  delegationsByMember: Record<string, number>;
}

export interface TeamBottleneck {
  type: 'overloaded_member' | 'stuck_task' | 'delegation_imbalance' | 'deadline_cluster';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedMember?: string;
  affectedTasks?: Todo[];
  suggestion: string;
}

export interface TeamOverview {
  totalTeamTasks: number;
  totalActive: number;
  totalCompleted: number;
  totalOverdue: number;
  teamCompletionRate: number;
  avgTasksPerMember: number;
  weeklyTeamCompleted: number;
  topPerformer: string | null;
  needsAttention: string | null;
}

export interface ManagerDashboardData {
  teamOverview: TeamOverview;
  memberStats: TeamMemberStats[];
  delegationStats: DelegationStats;
  bottlenecks: TeamBottleneck[];
  urgentDelegatedTasks: Todo[];
  recentTeamCompletions: Todo[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WORKLOAD_THRESHOLDS = {
  light: 3,      // 0-3 active tasks
  normal: 7,     // 4-7 active tasks
  heavy: 12,     // 8-12 active tasks
  overloaded: 13, // 13+ active tasks
};

const STUCK_TASK_DAYS = 7; // Task is stuck if no activity for 7+ days

// ============================================================================
// TEAM OVERVIEW
// ============================================================================

/**
 * Calculate overall team statistics
 */
export function calculateTeamOverview(
  todos: Todo[],
  teamMembers: string[]
): TeamOverview {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Team tasks only (assigned to team members)
  const teamTasks = todos.filter(t =>
    t.assigned_to && teamMembers.includes(t.assigned_to)
  );

  const activeTasks = teamTasks.filter(t => !t.completed);
  const completedTasks = teamTasks.filter(t => t.completed);

  const overdueTasks = activeTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    dueDate.setHours(23, 59, 59, 999);
    return dueDate < today;
  });

  // Weekly completions
  const weeklyCompleted = completedTasks.filter(t => {
    const completedDate = t.updated_at ? new Date(t.updated_at) : null;
    return completedDate && completedDate >= weekAgo;
  });

  // Calculate completion rate
  const totalWithCompletion = completedTasks.length + activeTasks.length;
  const completionRate = totalWithCompletion > 0
    ? Math.round((completedTasks.length / totalWithCompletion) * 100)
    : 0;

  // Find top performer (most completions this week)
  const memberCompletions: Record<string, number> = {};
  weeklyCompleted.forEach(t => {
    if (t.assigned_to) {
      memberCompletions[t.assigned_to] = (memberCompletions[t.assigned_to] || 0) + 1;
    }
  });

  let topPerformer: string | null = null;
  let maxCompletions = 0;
  Object.entries(memberCompletions).forEach(([member, count]) => {
    if (count > maxCompletions) {
      maxCompletions = count;
      topPerformer = member;
    }
  });

  // Find who needs attention (most overdue)
  const memberOverdue: Record<string, number> = {};
  overdueTasks.forEach(t => {
    if (t.assigned_to) {
      memberOverdue[t.assigned_to] = (memberOverdue[t.assigned_to] || 0) + 1;
    }
  });

  let needsAttention: string | null = null;
  let maxOverdue = 0;
  Object.entries(memberOverdue).forEach(([member, count]) => {
    if (count > maxOverdue) {
      maxOverdue = count;
      needsAttention = member;
    }
  });

  return {
    totalTeamTasks: teamTasks.length,
    totalActive: activeTasks.length,
    totalCompleted: completedTasks.length,
    totalOverdue: overdueTasks.length,
    teamCompletionRate: completionRate,
    avgTasksPerMember: teamMembers.length > 0
      ? Math.round(activeTasks.length / teamMembers.length * 10) / 10
      : 0,
    weeklyTeamCompleted: weeklyCompleted.length,
    topPerformer: topPerformer && maxCompletions >= 2 ? topPerformer : null,
    needsAttention: needsAttention && maxOverdue >= 2 ? needsAttention : null,
  };
}

// ============================================================================
// MEMBER STATISTICS
// ============================================================================

/**
 * Calculate detailed stats for each team member
 */
export function calculateMemberStats(
  todos: Todo[],
  teamMembers: string[]
): TeamMemberStats[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return teamMembers.map(member => {
    const memberTasks = todos.filter(t => t.assigned_to === member);
    const activeTasks = memberTasks.filter(t => !t.completed);
    const completedTasks = memberTasks.filter(t => t.completed);

    const overdueTasks = activeTasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(23, 59, 59, 999);
      return dueDate < today;
    });

    const dueTodayTasks = activeTasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate <= todayEnd;
    });

    const highPriorityTasks = activeTasks.filter(
      t => t.priority === 'urgent' || t.priority === 'high'
    );

    // Weekly completions
    const weeklyCompleted = completedTasks.filter(t => {
      const completedDate = t.updated_at ? new Date(t.updated_at) : null;
      return completedDate && completedDate >= weekAgo;
    });

    // Calculate completion rate
    const totalWithCompletion = completedTasks.length + activeTasks.length;
    const completionRate = totalWithCompletion > 0
      ? Math.round((completedTasks.length / totalWithCompletion) * 100)
      : 0;

    // Calculate average days to complete
    let totalDays = 0;
    let countWithDates = 0;
    completedTasks.forEach(t => {
      if (t.created_at && t.updated_at) {
        const created = new Date(t.created_at);
        const completed = new Date(t.updated_at);
        const days = Math.max(0, (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += days;
        countWithDates++;
      }
    });
    const avgDaysToComplete = countWithDates > 0
      ? Math.round(totalDays / countWithDates * 10) / 10
      : 0;

    // Determine workload level
    let workloadLevel: TeamMemberStats['workloadLevel'] = 'light';
    if (activeTasks.length >= WORKLOAD_THRESHOLDS.overloaded) {
      workloadLevel = 'overloaded';
    } else if (activeTasks.length >= WORKLOAD_THRESHOLDS.heavy) {
      workloadLevel = 'heavy';
    } else if (activeTasks.length >= WORKLOAD_THRESHOLDS.light + 1) {
      workloadLevel = 'normal';
    }

    // Adjust for overdue tasks
    if (overdueTasks.length >= 3 && workloadLevel !== 'overloaded') {
      workloadLevel = workloadLevel === 'light' ? 'normal' : 'heavy';
    }

    return {
      name: member,
      totalTasks: memberTasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      dueTodayTasks: dueTodayTasks.length,
      highPriorityTasks: highPriorityTasks.length,
      completionRate,
      avgDaysToComplete,
      weeklyCompleted: weeklyCompleted.length,
      workloadLevel,
    };
  }).sort((a, b) => {
    // Sort by active tasks descending (busiest first)
    return b.activeTasks - a.activeTasks;
  });
}

// ============================================================================
// DELEGATION TRACKING
// ============================================================================

/**
 * Calculate delegation statistics for a manager
 */
export function calculateDelegationStats(
  todos: Todo[],
  managerName: string,
  teamMembers: string[]
): DelegationStats {
  // Tasks created by the manager and assigned to team members
  const delegatedTasks = todos.filter(t =>
    t.created_by === managerName &&
    t.assigned_to &&
    t.assigned_to !== managerName &&
    teamMembers.includes(t.assigned_to)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingDelegated = delegatedTasks.filter(t => !t.completed);
  const completedDelegated = delegatedTasks.filter(t => t.completed);
  const overdueDelegated = pendingDelegated.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    dueDate.setHours(23, 59, 59, 999);
    return dueDate < today;
  });

  // Count delegations per team member
  const delegationsByMember: Record<string, number> = {};
  delegatedTasks.forEach(t => {
    if (t.assigned_to) {
      delegationsByMember[t.assigned_to] = (delegationsByMember[t.assigned_to] || 0) + 1;
    }
  });

  return {
    totalDelegated: delegatedTasks.length,
    pendingDelegated: pendingDelegated.length,
    completedDelegated: completedDelegated.length,
    overdueDelegated: overdueDelegated.length,
    delegationsByMember,
  };
}

// ============================================================================
// BOTTLENECK DETECTION
// ============================================================================

/**
 * Detect potential team bottlenecks and issues
 */
export function detectBottlenecks(
  todos: Todo[],
  teamMembers: string[],
  memberStats: TeamMemberStats[]
): TeamBottleneck[] {
  const bottlenecks: TeamBottleneck[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Check for overloaded team members
  memberStats.forEach(member => {
    if (member.workloadLevel === 'overloaded') {
      bottlenecks.push({
        type: 'overloaded_member',
        severity: 'critical',
        title: `${member.name} is overloaded`,
        description: `${member.activeTasks} active tasks, ${member.overdueTasks} overdue`,
        affectedMember: member.name,
        suggestion: 'Consider reassigning some tasks to team members with lighter workloads.',
      });
    } else if (member.workloadLevel === 'heavy' && member.overdueTasks >= 2) {
      bottlenecks.push({
        type: 'overloaded_member',
        severity: 'warning',
        title: `${member.name} needs support`,
        description: `Heavy workload with ${member.overdueTasks} overdue tasks`,
        affectedMember: member.name,
        suggestion: 'Check in with this team member and consider redistributing work.',
      });
    }
  });

  // 2. Check for stuck tasks (no activity for 7+ days)
  const activeTasks = todos.filter(t =>
    !t.completed &&
    t.assigned_to &&
    teamMembers.includes(t.assigned_to)
  );

  const stuckTasks = activeTasks.filter(t => {
    const lastActivity = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
    const daysSince = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= STUCK_TASK_DAYS;
  });

  if (stuckTasks.length > 0) {
    const criticalStuck = stuckTasks.filter(t =>
      t.priority === 'urgent' || t.priority === 'high'
    );

    if (criticalStuck.length > 0) {
      bottlenecks.push({
        type: 'stuck_task',
        severity: 'critical',
        title: `${criticalStuck.length} high-priority task${criticalStuck.length > 1 ? 's' : ''} stuck`,
        description: 'No activity for over a week on important tasks',
        affectedTasks: criticalStuck.slice(0, 3),
        suggestion: 'Follow up with assignees to understand blockers.',
      });
    } else if (stuckTasks.length >= 3) {
      bottlenecks.push({
        type: 'stuck_task',
        severity: 'warning',
        title: `${stuckTasks.length} tasks without recent activity`,
        description: 'These tasks may need attention or follow-up',
        affectedTasks: stuckTasks.slice(0, 3),
        suggestion: 'Review if these tasks are still relevant or need reassignment.',
      });
    }
  }

  // 3. Check for delegation imbalance
  const taskCountByMember = memberStats.map(m => m.activeTasks);
  const maxTasks = Math.max(...taskCountByMember);
  const minTasks = Math.min(...taskCountByMember);

  if (maxTasks - minTasks >= 8 && teamMembers.length >= 2) {
    const overloaded = memberStats.find(m => m.activeTasks === maxTasks);
    const underloaded = memberStats.find(m => m.activeTasks === minTasks);

    bottlenecks.push({
      type: 'delegation_imbalance',
      severity: 'warning',
      title: 'Uneven workload distribution',
      description: `${overloaded?.name} has ${maxTasks} tasks while ${underloaded?.name} has only ${minTasks}`,
      suggestion: 'Consider redistributing tasks for a more balanced workload.',
    });
  }

  // 4. Check for deadline clusters (many tasks due on same day)
  const upcomingDeadlines: Record<string, Todo[]> = {};
  activeTasks.forEach(t => {
    if (t.due_date) {
      const dateKey = new Date(t.due_date).toDateString();
      if (!upcomingDeadlines[dateKey]) {
        upcomingDeadlines[dateKey] = [];
      }
      upcomingDeadlines[dateKey].push(t);
    }
  });

  Object.entries(upcomingDeadlines).forEach(([dateStr, tasks]) => {
    const dueDate = new Date(dateStr);
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (tasks.length >= 5 && daysUntil <= 3 && daysUntil >= 0) {
      bottlenecks.push({
        type: 'deadline_cluster',
        severity: daysUntil <= 1 ? 'critical' : 'warning',
        title: `${tasks.length} tasks due ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
        description: 'Multiple deadlines clustered together',
        affectedTasks: tasks.slice(0, 3),
        suggestion: 'Review priorities and consider extending some deadlines.',
      });
    }
  });

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// URGENT DELEGATED TASKS
// ============================================================================

/**
 * Get urgent delegated tasks that need manager attention
 */
export function getUrgentDelegatedTasks(
  todos: Todo[],
  managerName: string,
  teamMembers: string[]
): Todo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  return todos
    .filter(t =>
      t.created_by === managerName &&
      t.assigned_to &&
      t.assigned_to !== managerName &&
      teamMembers.includes(t.assigned_to) &&
      !t.completed &&
      (
        // Overdue
        (t.due_date && new Date(t.due_date) < today) ||
        // Due today with high priority
        (t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) <= todayEnd &&
          (t.priority === 'urgent' || t.priority === 'high')) ||
        // Urgent priority regardless of due date
        t.priority === 'urgent'
      )
    )
    .sort((a, b) => {
      // Sort by priority first, then by due date
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return a.due_date ? -1 : 1;
    })
    .slice(0, 5);
}

// ============================================================================
// RECENT TEAM COMPLETIONS
// ============================================================================

/**
 * Get recent task completions across the team
 */
export function getRecentTeamCompletions(
  todos: Todo[],
  teamMembers: string[],
  maxResults: number = 5
): Todo[] {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return todos
    .filter(t =>
      t.completed &&
      t.assigned_to &&
      teamMembers.includes(t.assigned_to) &&
      t.updated_at &&
      new Date(t.updated_at) >= weekAgo
    )
    .sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at) : new Date(0);
      const dateB = b.updated_at ? new Date(b.updated_at) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, maxResults);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate all manager dashboard data in one call
 */
export function generateManagerDashboardData(
  todos: Todo[],
  managerName: string,
  teamMembers: string[]
): ManagerDashboardData {
  // Ensure manager is not in team members list for delegation stats
  const otherTeamMembers = teamMembers.filter(m => m !== managerName);

  const memberStats = calculateMemberStats(todos, otherTeamMembers);

  return {
    teamOverview: calculateTeamOverview(todos, otherTeamMembers),
    memberStats,
    delegationStats: calculateDelegationStats(todos, managerName, otherTeamMembers),
    bottlenecks: detectBottlenecks(todos, otherTeamMembers, memberStats),
    urgentDelegatedTasks: getUrgentDelegatedTasks(todos, managerName, otherTeamMembers),
    recentTeamCompletions: getRecentTeamCompletions(todos, otherTeamMembers),
  };
}
