/**
 * Integration layer between the Manager Dashboard and Multi-Agent Orchestrator.
 * Provides intelligent task analysis, decomposition suggestions, and workflow tracking.
 */

import { Todo } from '@/types/todo';
import { TeamMemberStats, TeamBottleneck } from './managerDashboardInsights';

// Types for orchestrator integration
export interface TaskDecomposition {
  originalTask: string;
  suggestedSubtasks: SubtaskSuggestion[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  recommendedWorkflow: string;
}

export interface SubtaskSuggestion {
  title: string;
  description: string;
  agentType: AgentType;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
  estimatedEffort: 'small' | 'medium' | 'large';
}

export type AgentType =
  | 'business_analyst'
  | 'tech_lead'
  | 'backend'
  | 'frontend'
  | 'database'
  | 'security'
  | 'reviewer'
  | 'ux';

export interface AgentMapping {
  agentType: AgentType;
  teamMember: string;
  skills: string[];
}

export interface WorkflowSuggestion {
  taskId: string;
  currentBottleneck: TeamBottleneck;
  suggestedAction: string;
  agentRecommendation: AgentType;
  priority: number;
}

// Agent type to human-readable name mapping
const AGENT_NAMES: Record<AgentType, string> = {
  business_analyst: 'Business Analyst',
  tech_lead: 'Tech Lead',
  backend: 'Backend Engineer',
  frontend: 'Frontend Engineer',
  database: 'Database Engineer',
  security: 'Security Reviewer',
  reviewer: 'Code Reviewer',
  ux: 'UX Engineer',
};

// Keywords that indicate task complexity and required agents
const TASK_KEYWORDS: Record<AgentType, string[]> = {
  business_analyst: ['requirements', 'user story', 'acceptance criteria', 'stakeholder', 'scope'],
  tech_lead: ['architecture', 'design', 'system', 'infrastructure', 'scalability'],
  backend: ['api', 'server', 'endpoint', 'service', 'database', 'authentication', 'backend'],
  frontend: ['ui', 'component', 'page', 'form', 'button', 'modal', 'frontend', 'css', 'style'],
  database: ['schema', 'migration', 'query', 'index', 'table', 'database', 'sql'],
  security: ['security', 'auth', 'permission', 'encryption', 'vulnerability', 'audit'],
  reviewer: ['review', 'test', 'quality', 'bug', 'fix'],
  ux: ['design', 'wireframe', 'prototype', 'user experience', 'usability'],
};

// Academic task categories for research and coursework workflows
export type AcademicTaskCategory =
  | 'research'
  | 'meeting'
  | 'analysis'
  | 'submission'
  | 'revision'
  | 'presentation'
  | 'writing'
  | 'reading'
  | 'coursework'
  | 'admin';

const ACADEMIC_TASK_KEYWORDS: Record<AcademicTaskCategory, string[]> = {
  research: ['literature review', 'data collection', 'experiment', 'study', 'hypothesis', 'methodology', 'participant'],
  writing: ['draft', 'paper', 'manuscript', 'thesis', 'dissertation', 'abstract', 'write introduction', 'write methods'],
  analysis: ['statistics', 'data analysis', 'results', 'R script', 'python', 'SPSS', 'regression', 'visualization'],
  submission: ['submit', 'deadline', 'conference', 'journal', 'camera ready', 'supplementary'],
  meeting: ['advisor', 'committee', 'lab meeting', 'seminar', 'office hours', 'supervisor', 'mentor'],
  presentation: ['defense', 'poster', 'talk', 'slides', 'conference presentation', 'present'],
  reading: ['article', 'chapter', 'textbook', 'review paper', 'read paper', 'annotate'],
  coursework: ['assignment', 'homework', 'exam', 'quiz', 'grade', 'problem set', 'lab report'],
  revision: ['revise', 'edits', 'feedback', 'reviewer comments', 'resubmit', 'corrections'],
  admin: ['forms', 'registration', 'IRB', 'grant administration', 'reimbursement', 'travel form'],
};

export interface AcademicTaskAnalysis {
  category: AcademicTaskCategory | null;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedPriority: 'low' | 'medium' | 'high' | 'urgent';
  isCollaborative: boolean;
  requiresFollowUp: boolean;
  estimatedDuration: 'quick' | 'standard' | 'extended';
}

/**
 * Analyze a task for academic-specific patterns.
 * Useful for understanding workload distribution in research/academic context.
 */
export function analyzeAcademicTask(taskText: string, dueDate?: string | null): AcademicTaskAnalysis {
  const text = taskText.toLowerCase();

  // Detect category
  let category: AcademicTaskCategory | null = null;
  for (const [cat, keywords] of Object.entries(ACADEMIC_TASK_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      category = cat as AcademicTaskCategory;
      break;
    }
  }

  // Determine urgency based on category and due date
  let urgencyLevel: AcademicTaskAnalysis['urgencyLevel'] = 'medium';

  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) urgencyLevel = 'critical';
    else if (daysUntilDue <= 1) urgencyLevel = 'high';
    else if (daysUntilDue <= 3) urgencyLevel = 'medium';
    else urgencyLevel = 'low';
  }

  // High-urgency categories (deadlines, defenses)
  if (category === 'submission' || category === 'presentation') {
    urgencyLevel = urgencyLevel === 'low' ? 'medium' : urgencyLevel;
  }

  // Map urgency to priority
  const priorityMap: Record<AcademicTaskAnalysis['urgencyLevel'], AcademicTaskAnalysis['suggestedPriority']> = {
    critical: 'urgent',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  // Collaborative task detection (involves others)
  const collaborativeKeywords = ['advisor', 'committee', 'meeting', 'lab', 'team', 'coauthor', 'collaborator', 'present'];
  const isCollaborative = collaborativeKeywords.some(kw => text.includes(kw));

  // Follow-up detection
  const followUpKeywords = ['follow', 'check', 'confirm', 'verify', 'remind', 'wait for', 'response'];
  const requiresFollowUp = followUpKeywords.some(kw => text.includes(kw));

  // Duration estimation
  let estimatedDuration: AcademicTaskAnalysis['estimatedDuration'] = 'standard';
  if (category === 'writing' || category === 'research' || category === 'analysis') {
    estimatedDuration = 'extended';
  } else if (category === 'reading' || category === 'admin') {
    estimatedDuration = 'quick';
  }

  return {
    category,
    urgencyLevel,
    suggestedPriority: priorityMap[urgencyLevel],
    isCollaborative,
    requiresFollowUp,
    estimatedDuration,
  };
}

/**
 * Get workload summary by academic task category.
 */
export function getAcademicWorkloadSummary(todos: Todo[]): Record<AcademicTaskCategory, { active: number; completed: number; overdue: number }> {
  const summary: Record<AcademicTaskCategory, { active: number; completed: number; overdue: number }> = {
    research: { active: 0, completed: 0, overdue: 0 },
    meeting: { active: 0, completed: 0, overdue: 0 },
    analysis: { active: 0, completed: 0, overdue: 0 },
    submission: { active: 0, completed: 0, overdue: 0 },
    revision: { active: 0, completed: 0, overdue: 0 },
    presentation: { active: 0, completed: 0, overdue: 0 },
    writing: { active: 0, completed: 0, overdue: 0 },
    reading: { active: 0, completed: 0, overdue: 0 },
    coursework: { active: 0, completed: 0, overdue: 0 },
    admin: { active: 0, completed: 0, overdue: 0 },
  };

  const now = new Date();

  for (const todo of todos) {
    const analysis = analyzeAcademicTask(todo.text, todo.due_date);
    if (!analysis.category) continue;

    const cat = summary[analysis.category];

    if (todo.completed) {
      cat.completed++;
    } else {
      cat.active++;
      if (todo.due_date && new Date(todo.due_date) < now) {
        cat.overdue++;
      }
    }
  }

  return summary;
}

/**
 * Analyze a task description and suggest decomposition into subtasks.
 * This mirrors what the orchestrator's build_prompt tool does.
 */
export function analyzeTaskForDecomposition(taskTitle: string, taskDescription?: string): TaskDecomposition {
  const fullText = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
  const detectedAgents: AgentType[] = [];

  // Detect which agents would be needed based on keywords
  for (const [agentType, keywords] of Object.entries(TASK_KEYWORDS)) {
    if (keywords.some(keyword => fullText.includes(keyword))) {
      detectedAgents.push(agentType as AgentType);
    }
  }

  // If no specific agents detected, assume it's a general task
  if (detectedAgents.length === 0) {
    detectedAgents.push('backend'); // Default assumption
  }

  // Determine complexity based on number of agents needed
  const estimatedComplexity: TaskDecomposition['estimatedComplexity'] =
    detectedAgents.length <= 1 ? 'low' :
    detectedAgents.length <= 3 ? 'medium' : 'high';

  // Generate subtask suggestions
  const suggestedSubtasks: SubtaskSuggestion[] = detectedAgents.map((agentType, index) => ({
    title: generateSubtaskTitle(taskTitle, agentType),
    description: generateSubtaskDescription(taskTitle, agentType),
    agentType,
    priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
    dependencies: index > 0 ? [detectedAgents[index - 1]] : [],
    estimatedEffort: estimatedComplexity === 'high' ? 'large' : estimatedComplexity === 'medium' ? 'medium' : 'small',
  }));

  // Determine workflow type
  const recommendedWorkflow =
    detectedAgents.length > 3 ? 'full_stack' :
    detectedAgents.includes('frontend') && detectedAgents.includes('backend') ? 'full_stack' :
    detectedAgents.includes('backend') ? 'backend_focused' :
    detectedAgents.includes('frontend') ? 'frontend_focused' :
    'general';

  return {
    originalTask: taskTitle,
    suggestedSubtasks,
    estimatedComplexity,
    recommendedWorkflow,
  };
}

function generateSubtaskTitle(originalTask: string, agentType: AgentType): string {
  const prefix = AGENT_NAMES[agentType];
  const action = getAgentAction(agentType);
  return `[${prefix}] ${action}: ${originalTask}`;
}

function generateSubtaskDescription(originalTask: string, agentType: AgentType): string {
  const descriptions: Record<AgentType, string> = {
    business_analyst: `Analyze requirements and define acceptance criteria for: ${originalTask}`,
    tech_lead: `Design technical architecture and approach for: ${originalTask}`,
    backend: `Implement backend logic and API endpoints for: ${originalTask}`,
    frontend: `Build UI components and user interactions for: ${originalTask}`,
    database: `Design and implement database schema changes for: ${originalTask}`,
    security: `Review security implications and implement safeguards for: ${originalTask}`,
    reviewer: `Review code quality and suggest improvements for: ${originalTask}`,
    ux: `Design user experience and create wireframes for: ${originalTask}`,
  };
  return descriptions[agentType];
}

function getAgentAction(agentType: AgentType): string {
  const actions: Record<AgentType, string> = {
    business_analyst: 'Requirements',
    tech_lead: 'Architecture',
    backend: 'Backend',
    frontend: 'Frontend',
    database: 'Database',
    security: 'Security Review',
    reviewer: 'Code Review',
    ux: 'UX Design',
  };
  return actions[agentType];
}

/**
 * Suggest optimal task assignments based on team workload and task requirements.
 */
export function suggestOptimalAssignment(
  task: TaskDecomposition,
  teamStats: TeamMemberStats[],
  agentMappings: AgentMapping[]
): Map<string, string> {
  const assignments = new Map<string, string>();

  for (const subtask of task.suggestedSubtasks) {
    // Find team members who can handle this agent type
    const capableMembers = agentMappings
      .filter(m => m.agentType === subtask.agentType)
      .map(m => m.teamMember);

    if (capableMembers.length === 0) {
      // No specific mapping, find least loaded team member
      const sortedStats = [...teamStats].sort((a, b) => a.activeTasks - b.activeTasks);
      const leastLoaded = sortedStats[0];
      if (leastLoaded) {
        assignments.set(subtask.title, leastLoaded.name);
      }
    } else {
      // Find the least loaded capable member
      const capableStats = teamStats.filter(s => capableMembers.includes(s.name));
      const sortedCapable = [...capableStats].sort((a, b) => a.activeTasks - b.activeTasks);
      const bestChoice = sortedCapable[0];
      if (bestChoice) {
        assignments.set(subtask.title, bestChoice.name);
      }
    }
  }

  return assignments;
}

/**
 * Generate workflow suggestions to resolve detected bottlenecks.
 */
export function generateBottleneckResolutions(
  bottlenecks: TeamBottleneck[],
  _todos: Todo[]
): WorkflowSuggestion[] {
  const suggestions: WorkflowSuggestion[] = [];

  for (const bottleneck of bottlenecks) {
    // Get the first affected task ID if available
    const taskId = bottleneck.affectedTasks?.[0]?.id ?? '';

    let suggestedAction = '';
    let agentRecommendation: AgentType = 'reviewer';

    switch (bottleneck.type) {
      case 'overloaded_member':
        suggestedAction = 'Redistribute tasks or bring in additional help for this team member';
        agentRecommendation = 'business_analyst';
        break;
      case 'stuck_task':
        suggestedAction = 'Identify and resolve blocking dependencies; consider breaking into smaller tasks';
        agentRecommendation = 'tech_lead';
        break;
      case 'delegation_imbalance':
        suggestedAction = 'Balance task distribution across team members based on skills and capacity';
        agentRecommendation = 'business_analyst';
        break;
      case 'deadline_cluster':
        suggestedAction = 'Prioritize and sequence tasks to avoid deadline conflicts; consider parallel work streams';
        agentRecommendation = 'tech_lead';
        break;
      default:
        suggestedAction = bottleneck.suggestion;
        agentRecommendation = 'tech_lead';
    }

    suggestions.push({
      taskId,
      currentBottleneck: bottleneck,
      suggestedAction,
      agentRecommendation,
      priority: bottleneck.severity === 'critical' ? 3 : bottleneck.severity === 'warning' ? 2 : 1,
    });
  }

  // Sort by priority (highest first)
  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Get a summary of how orchestrator agents could help the team.
 */
export function getOrchestratorCapabilities(): { agentType: AgentType; name: string; capabilities: string[] }[] {
  return [
    {
      agentType: 'business_analyst',
      name: 'Business Analyst',
      capabilities: [
        'Analyze and clarify requirements',
        'Write user stories and acceptance criteria',
        'Identify edge cases and scenarios',
      ],
    },
    {
      agentType: 'tech_lead',
      name: 'Tech Lead',
      capabilities: [
        'Design system architecture',
        'Make technology decisions',
        'Plan implementation strategy',
      ],
    },
    {
      agentType: 'backend',
      name: 'Backend Engineer',
      capabilities: [
        'Implement API endpoints',
        'Write business logic',
        'Handle data processing',
      ],
    },
    {
      agentType: 'frontend',
      name: 'Frontend Engineer',
      capabilities: [
        'Build UI components',
        'Implement user interactions',
        'Style and responsive design',
      ],
    },
    {
      agentType: 'security',
      name: 'Security Reviewer',
      capabilities: [
        'Audit for vulnerabilities',
        'Review authentication flows',
        'Ensure data protection',
      ],
    },
    {
      agentType: 'reviewer',
      name: 'Code Reviewer',
      capabilities: [
        'Review code quality',
        'Suggest improvements',
        'Ensure best practices',
      ],
    },
  ];
}

/**
 * Format orchestrator workflow plan for display in the dashboard.
 */
export interface WorkflowPhase {
  phase: number;
  parallel: boolean;
  agents: {
    agentName: string;
    agentType: AgentType;
    status: 'pending' | 'in_progress' | 'completed';
  }[];
}

export function formatWorkflowForDashboard(
  workflowPlan: { phases: Array<{ phase: number; parallel: boolean; agents: Array<{ agent: string; agent_name: string }> }> }
): WorkflowPhase[] {
  return workflowPlan.phases.map(phase => ({
    phase: phase.phase,
    parallel: phase.parallel,
    agents: phase.agents.map(agent => ({
      agentName: agent.agent_name,
      agentType: agent.agent as AgentType,
      status: 'pending' as const,
    })),
  }));
}
