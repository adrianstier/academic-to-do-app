/**
 * Task Suggestions and Streak Tracking
 *
 * Provides intelligent next task suggestions and tracks completion streaks
 * to encourage productivity.
 */

import { Todo, TodoPriority, ActivityLogEntry } from '@/types/todo';

const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Streak window in milliseconds (30 minutes)
const STREAK_WINDOW_MS = 30 * 60 * 1000;

/**
 * Gets the next suggested tasks for a user after completing a task
 * Sorts by priority and due date to surface most important tasks first
 */
export function getNextSuggestedTasks(
  todos: Todo[],
  currentUser: string,
  completedTaskId: string,
  maxResults: number = 3
): Todo[] {
  return todos
    .filter(todo =>
      !todo.completed &&
      todo.id !== completedTaskId &&
      todo.assigned_to === currentUser
    )
    .sort((a, b) => {
      // First sort by priority (higher priority first)
      const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then sort by due date (sooner dates first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;

      // Finally sort by creation date (older first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, maxResults);
}

/**
 * Calculates the current completion streak for a user
 * A streak counts consecutive task completions within 30 minutes of each other
 */
export function calculateCompletionStreak(
  activityLog: ActivityLogEntry[],
  userName: string
): number {
  // Get completions by this user, sorted by most recent first
  const userCompletions = activityLog
    .filter(entry =>
      entry.user_name === userName &&
      (entry.action === 'task_completed' ||
       (entry.action === 'status_changed' && entry.details?.to === 'done'))
    )
    .sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  if (userCompletions.length === 0) {
    return 0;
  }

  // Count consecutive completions within the streak window
  let streak = 1;
  let lastTime = new Date(userCompletions[0].created_at).getTime();

  for (let i = 1; i < userCompletions.length; i++) {
    const completionTime = new Date(userCompletions[i].created_at).getTime();

    // If this completion was within 30 minutes of the previous one, count it
    if (lastTime - completionTime <= STREAK_WINDOW_MS) {
      streak++;
      lastTime = completionTime;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Gets a random encouragement message for task completion
 */
export function getEncouragementMessage(streakCount: number): string {
  // Streak-specific messages
  if (streakCount >= 10) {
    return "Ten tasks! You're a productivity machine.";
  }
  if (streakCount >= 5) {
    return "Five tasks done! Impressive focus.";
  }
  if (streakCount >= 3) {
    return "Three in a row! You're crushing it.";
  }

  // Regular encouragement messages
  const messages = [
    "Nice work! One less thing on your plate.",
    "Done and done. You're on a roll.",
    "That's the way. Keep that momentum going.",
    "Checked off. What's next?",
    "Another one down. You've got this.",
    "Solid progress. Keep it up!",
    "Well done. Ready for the next one?",
    "Task complete. You're making moves.",
    "That's how it's done!",
    "Progress feels good, doesn't it?",
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Gets the streak badge text if applicable
 */
export function getStreakBadge(streakCount: number): string | null {
  if (streakCount >= 10) return `🔥 ${streakCount} task streak!`;
  if (streakCount >= 5) return `🔥 ${streakCount} in a row!`;
  if (streakCount >= 3) return `🔥 ${streakCount} task streak`;
  return null;
}

/**
 * Determines celebration intensity based on task and streak
 */
export function getCelebrationIntensity(
  priority: TodoPriority,
  streakCount: number
): 'light' | 'medium' | 'high' {
  // High priority or good streak = more celebration
  if (priority === 'urgent' || streakCount >= 5) {
    return 'high';
  }
  if (priority === 'high' || streakCount >= 3) {
    return 'medium';
  }
  return 'light';
}

/**
 * Gets the appropriate dismiss button text
 */
export function getDismissButtonText(nextTasksCount: number): string {
  if (nextTasksCount > 0) {
    return "Keep Going";
  }
  return "Done for Now";
}
