'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PenLine,
  Send,
  Clock,
  RefreshCw,
  CheckCircle,
  BookOpen,
  User,
  Calendar,
  AlertCircle,
  LucideIcon,
  ChevronRight,
  ChevronLeft,
  Filter,
  X,
  Eye,
  GripVertical,
  ArrowRight,
  Users,
  FolderOpen,
  Hourglass,
} from 'lucide-react';
import { Todo, PRIORITY_CONFIG } from '@/types/todo';
import { useTodoStore } from '@/store/todoStore';
import { analyzeTaskPattern } from '@/lib/academicPatterns';

// =====================================================================
// MANUSCRIPT PIPELINE VIEW
// Full-featured horizontal pipeline for tracking publications through:
// Draft -> Internal Review -> Submitted -> Under Review -> Revisions -> Accepted -> Published
//
// Features:
// - Drag-and-drop between stages via @dnd-kit
// - Click-to-move stage selector on each card
// - Filter by project and assigned person
// - Summary stats bar at top
// - Days-in-stage calculation
// - Responsive horizontal scroll with snap
// =====================================================================

interface ManuscriptPipelineViewProps {
  todos: Todo[];
  onTodoClick: (todoId: string) => void;
  onStatusChange: (todoId: string, newCategory: string) => void;
}

interface PipelineStage {
  id: string;
  label: string;
  color: string;
  Icon: LucideIcon;
  description: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'writing', label: 'Draft', color: '#6366f1', Icon: PenLine, description: 'Initial drafting' },
  { id: 'internal_review', label: 'Internal Review', color: '#a855f7', Icon: Eye, description: 'Co-author review' },
  { id: 'submission', label: 'Submitted', color: '#f59e0b', Icon: Send, description: 'Sent to journal' },
  { id: 'under_review', label: 'Under Review', color: '#3b82f6', Icon: Clock, description: 'Peer review' },
  { id: 'revision', label: 'Revisions', color: '#8b5cf6', Icon: RefreshCw, description: 'Addressing feedback' },
  { id: 'accepted', label: 'Accepted', color: '#10b981', Icon: CheckCircle, description: 'Ready to publish' },
  { id: 'published', label: 'Published', color: '#059669', Icon: BookOpen, description: 'In print / online' },
];

// ---- Stage classification logic ----

function getPipelineStage(todo: Todo): string | null {
  const pattern = analyzeTaskPattern(todo.text);
  if (!pattern) return null;

  const { category } = pattern;
  switch (category) {
    case 'writing':
      return 'writing';
    case 'submission':
      return 'submission';
    case 'revision':
      return 'revision';
    default:
      return null;
  }
}

function getStageFromNotes(todo: Todo): string | null {
  if (!todo.notes) return null;
  const notesLower = todo.notes.toLowerCase();

  // Explicit stage tag: [stage:under_review], [stage:accepted], etc.
  const stageMatch = notesLower.match(/\[stage:(\w+)\]/);
  if (stageMatch) {
    const stageId = stageMatch[1];
    if (PIPELINE_STAGES.some(s => s.id === stageId)) {
      return stageId;
    }
  }

  // Implicit keywords in notes
  if (notesLower.includes('published') || notesLower.includes('in press')) return 'published';
  if (notesLower.includes('accepted')) return 'accepted';
  if (notesLower.includes('under review') || notesLower.includes('peer review')) return 'under_review';
  if (notesLower.includes('internal review') || notesLower.includes('co-author review')) return 'internal_review';

  return null;
}

function classifyTodo(todo: Todo): string | null {
  const notesStage = getStageFromNotes(todo);
  if (notesStage) return notesStage;
  return getPipelineStage(todo);
}

// ---- Date/time helpers ----

function formatDueDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === today.getTime()) return 'Today';
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(date: string): boolean {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Calculate approximate days a todo has been in its current stage.
 * Uses updated_at as proxy (last time the task was modified).
 * Falls back to created_at if no updated_at.
 */
function getDaysInStage(todo: Todo): number {
  const referenceDate = todo.updated_at || todo.created_at;
  if (!referenceDate) return 0;
  const ref = new Date(referenceDate);
  const now = new Date();
  const diffMs = now.getTime() - ref.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getPriorityBorderColor(priority: string): string {
  switch (priority) {
    case 'urgent': return '#ef4444';
    case 'high': return '#f59e0b';
    case 'medium': return '#3b82f6';
    case 'low': return '#6b7280';
    default: return '#6b7280';
  }
}

// =====================================================================
// SORTABLE PIPELINE CARD (draggable)
// =====================================================================

interface SortablePipelineCardProps {
  todo: Todo;
  currentStageId: string;
  onClick: () => void;
  onMoveToStage: (todoId: string, stageId: string) => void;
}

function SortablePipelineCard({ todo, currentStageId, onClick, onMoveToStage }: SortablePipelineCardProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  const storeProjects = useTodoStore(state => state.projects);
  const project = todo.project_id ? storeProjects.find(p => p.id === todo.project_id) : null;
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);
  const daysInStage = getDaysInStage(todo);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Close move menu on outside click
  useEffect(() => {
    if (!showMoveMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveMenu]);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, [data-move-menu]')) {
      return;
    }
    onClick();
  };

  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStageId);

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftWidth: '3px',
        borderLeftColor: getPriorityBorderColor(priority),
      }}
      {...attributes}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onClick={handleCardClick}
      className={`group relative cursor-pointer rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-sm overflow-hidden transition-all ${
        isDragging
          ? 'shadow-xl ring-2 ring-[var(--accent)] z-50'
          : 'hover:border-[var(--border-hover)] hover:shadow-md'
      }`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute top-0 left-0 w-full h-5 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Drag to move to another stage"
      >
        <GripVertical className="w-3 h-3 text-[var(--text-light)]" />
      </div>

      <div className="p-2.5 pt-3">
        {/* Title */}
        <p
          className={`text-xs font-medium leading-snug line-clamp-2 ${
            todo.completed
              ? 'line-through text-[var(--text-light)]'
              : 'text-[var(--foreground)]'
          }`}
        >
          {todo.text}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {project && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium max-w-[120px] truncate"
              style={{ backgroundColor: project.color + '18', color: project.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate">{project.name}</span>
            </span>
          )}

          <span
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            {priorityConfig.label}
          </span>

          {/* Days in stage badge */}
          {daysInStage > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium ${
                daysInStage > 14
                  ? 'bg-red-500/10 text-red-500'
                  : daysInStage > 7
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
              }`}
            >
              <Hourglass className="w-2.5 h-2.5" />
              {daysInStage}d
            </span>
          )}
        </div>

        {/* Bottom row: assignee + due date */}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          {todo.assigned_to && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-muted)] truncate max-w-[80px]">
              <User className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{todo.assigned_to}</span>
            </span>
          )}

          {todo.due_date && (
            <span
              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium ml-auto ${
                todo.completed
                  ? 'text-[var(--text-light)]'
                  : overdue
                    ? 'bg-red-500 text-white'
                    : 'text-[var(--text-muted)]'
              }`}
            >
              {overdue ? (
                <AlertCircle className="w-2.5 h-2.5" />
              ) : (
                <Calendar className="w-2.5 h-2.5" />
              )}
              {formatDueDate(todo.due_date)}
            </span>
          )}
        </div>

        {/* Move-to-stage buttons (quick navigation) */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Previous stage arrow */}
          {currentStageIndex > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveToStage(todo.id, PIPELINE_STAGES[currentStageIndex - 1].id);
              }}
              className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              title={`Move to ${PIPELINE_STAGES[currentStageIndex - 1].label}`}
              aria-label={`Move to ${PIPELINE_STAGES[currentStageIndex - 1].label}`}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Stage selector dropdown */}
          <div className="relative" ref={moveMenuRef} data-move-menu>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveMenu(!showMoveMenu);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Move to stage"
            >
              Move to...
            </button>

            <AnimatePresence>
              {showMoveMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
                  data-move-menu
                >
                  {PIPELINE_STAGES.map((stage) => {
                    const isCurrent = stage.id === currentStageId;
                    const StageIcon = stage.Icon;
                    return (
                      <button
                        key={stage.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrent) {
                            onMoveToStage(todo.id, stage.id);
                          }
                          setShowMoveMenu(false);
                        }}
                        disabled={isCurrent}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                          isCurrent
                            ? 'text-[var(--text-light)] bg-[var(--surface-2)] cursor-default'
                            : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <StageIcon className="w-3 h-3" style={{ color: stage.color }} />
                        <span>{stage.label}</span>
                        {isCurrent && (
                          <span className="ml-auto text-[10px] text-[var(--text-light)]">Current</span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Next stage arrow */}
          {currentStageIndex < PIPELINE_STAGES.length - 1 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveToStage(todo.id, PIPELINE_STAGES[currentStageIndex + 1].id);
              }}
              className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              title={`Move to ${PIPELINE_STAGES[currentStageIndex + 1].label}`}
              aria-label={`Move to ${PIPELINE_STAGES[currentStageIndex + 1].label}`}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-5" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// =====================================================================
// DRAG OVERLAY CARD (shows while dragging)
// =====================================================================

function DragOverlayCard({ todo }: { todo: Todo }) {
  const storeProjects = useTodoStore(state => state.projects);
  const project = todo.project_id ? storeProjects.find(p => p.id === todo.project_id) : null;
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];

  return (
    <div
      className="w-[220px] rounded-lg bg-[var(--surface)] border-2 border-[var(--accent)] shadow-2xl ring-4 ring-[var(--accent)]/20 overflow-hidden"
      style={{ borderLeftWidth: '3px', borderLeftColor: getPriorityBorderColor(priority) }}
    >
      <div className="p-2.5">
        <p className="text-xs font-medium leading-snug line-clamp-2 text-[var(--foreground)]">
          {todo.text}
        </p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {project && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: project.color + '18', color: project.color }}
            >
              {project.name}
            </span>
          )}
          <span
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            {priorityConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// DROPPABLE PIPELINE COLUMN
// =====================================================================

interface PipelineColumnProps {
  stage: PipelineStage;
  todos: Todo[];
  onTodoClick: (todoId: string) => void;
  onMoveToStage: (todoId: string, stageId: string) => void;
  isActiveDrag: boolean;
  isCurrentOver: boolean;
}

function PipelineColumn({ stage, todos, onTodoClick, onMoveToStage, isActiveDrag, isCurrentOver }: PipelineColumnProps) {
  const { Icon } = stage;
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const showDropHighlight = isOver || isCurrentOver;

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[240px] min-w-[240px] flex flex-col rounded-xl border overflow-hidden transition-all duration-200 ${
        showDropHighlight
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 shadow-lg'
          : isActiveDrag
            ? 'border-[var(--border)] shadow-sm'
            : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
      style={{
        backgroundColor: showDropHighlight ? stage.color + '08' : undefined,
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b"
        style={{ backgroundColor: stage.color + '12', borderColor: stage.color + '30' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: stage.color }} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
              {stage.label}
            </h3>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-md text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: stage.color }}
        >
          {todos.length}
        </span>
      </div>

      {/* Column body */}
      <SortableContext
        items={todos.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[120px]">
          <AnimatePresence mode="popLayout">
            {todos.length > 0 ? (
              todos.map(todo => (
                <SortablePipelineCard
                  key={todo.id}
                  todo={todo}
                  currentStageId={stage.id}
                  onClick={() => onTodoClick(todo.id)}
                  onMoveToStage={onMoveToStage}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 text-[var(--text-light)]"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                  style={{ backgroundColor: stage.color + '12' }}
                >
                  <Icon className="w-5 h-5" style={{ color: stage.color, opacity: 0.5 }} />
                </div>
                <p className="text-xs text-center">
                  {isActiveDrag ? 'Drop here' : 'No manuscripts'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SortableContext>
    </div>
  );
}

// =====================================================================
// SUMMARY STATS BAR
// =====================================================================

interface SummaryStatsProps {
  stagedTodos: Record<string, Todo[]>;
  totalCount: number;
}

function SummaryStats({ stagedTodos, totalCount }: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {PIPELINE_STAGES.map(stage => {
        const count = stagedTodos[stage.id]?.length || 0;
        const StageIcon = stage.Icon;
        return (
          <div
            key={stage.id}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ backgroundColor: stage.color + '18' }}
            >
              <StageIcon className="w-3.5 h-3.5" style={{ color: stage.color }} />
            </div>
            <span className="text-lg font-bold text-[var(--foreground)] leading-none">
              {count}
            </span>
            <span className="text-[10px] font-medium text-[var(--text-muted)] text-center leading-tight">
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// FILTER BAR
// =====================================================================

interface FilterBarProps {
  projects: { id: string; name: string; color: string }[];
  assignees: string[];
  selectedProject: string | null;
  selectedAssignee: string | null;
  onProjectChange: (projectId: string | null) => void;
  onAssigneeChange: (assignee: string | null) => void;
  filteredCount: number;
  totalCount: number;
}

function FilterBar({
  projects,
  assignees,
  selectedProject,
  selectedAssignee,
  onProjectChange,
  onAssigneeChange,
  filteredCount,
  totalCount,
}: FilterBarProps) {
  const hasActiveFilter = selectedProject !== null || selectedAssignee !== null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
        <Filter className="w-3.5 h-3.5" />
        <span>Filter:</span>
      </div>

      {/* Project filter */}
      <div className="relative">
        <select
          value={selectedProject || ''}
          onChange={(e) => onProjectChange(e.target.value || null)}
          className="appearance-none text-xs px-2 py-1 pr-6 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] cursor-pointer hover:border-[var(--border-hover)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          aria-label="Filter by project"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <FolderOpen className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
      </div>

      {/* Assignee filter */}
      <div className="relative">
        <select
          value={selectedAssignee || ''}
          onChange={(e) => onAssigneeChange(e.target.value || null)}
          className="appearance-none text-xs px-2 py-1 pr-6 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] cursor-pointer hover:border-[var(--border-hover)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          aria-label="Filter by assigned person"
        >
          <option value="">All People</option>
          {assignees.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <Users className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
      </div>

      {/* Clear filters */}
      {hasActiveFilter && (
        <button
          onClick={() => {
            onProjectChange(null);
            onAssigneeChange(null);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}

      {/* Filter count indicator */}
      {hasActiveFilter && filteredCount !== totalCount && (
        <span className="text-[10px] text-[var(--text-light)]">
          Showing {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  );
}

// =====================================================================
// MAIN PIPELINE VIEW
// =====================================================================

export default function ManuscriptPipelineView({
  todos,
  onTodoClick,
  onStatusChange,
}: ManuscriptPipelineViewProps) {
  // ---- Local filter state ----
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  // ---- Drag state ----
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState('');

  // ---- Store data ----
  const storeProjects = useTodoStore(state => state.projects);

  // ---- Sensors ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // ---- Custom collision detection that prefers columns ----
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    const rectCollisions = rectIntersection(args);
    const allCollisions = [...pointerCollisions, ...rectCollisions];
    const stageIds = PIPELINE_STAGES.map(s => s.id);

    const columnCollision = allCollisions.find(
      collision => stageIds.includes(collision.id as string)
    );
    if (columnCollision) return [columnCollision];
    return allCollisions.length > 0 ? allCollisions : [];
  }, []);

  // ---- Classify all todos into pipeline stages (UNFILTERED) ----
  const { allStagedTodos, allPipelineTodos, totalPipelineCount } = useMemo(() => {
    const stageMap: Record<string, Todo[]> = {};
    const pipelineTodos: Todo[] = [];
    for (const stage of PIPELINE_STAGES) {
      stageMap[stage.id] = [];
    }

    for (const todo of todos) {
      const stageId = classifyTodo(todo);
      if (stageId && stageMap[stageId]) {
        stageMap[stageId].push(todo);
        pipelineTodos.push(todo);
      }
    }

    return {
      allStagedTodos: stageMap,
      allPipelineTodos: pipelineTodos,
      totalPipelineCount: pipelineTodos.length,
    };
  }, [todos]);

  // ---- Extract unique projects and assignees from pipeline todos ----
  const { availableProjects, availableAssignees } = useMemo(() => {
    const projectIds = new Set<string>();
    const assigneeSet = new Set<string>();

    for (const todo of allPipelineTodos) {
      if (todo.project_id) projectIds.add(todo.project_id);
      if (todo.assigned_to) assigneeSet.add(todo.assigned_to);
    }

    const projects = storeProjects.filter(p => projectIds.has(p.id));
    const assignees = Array.from(assigneeSet).sort();

    return { availableProjects: projects, availableAssignees: assignees };
  }, [allPipelineTodos, storeProjects]);

  // ---- Apply filters to staged todos ----
  const { filteredStagedTodos, filteredPipelineCount } = useMemo(() => {
    const filtered: Record<string, Todo[]> = {};
    let count = 0;

    for (const stage of PIPELINE_STAGES) {
      const stageTodos = allStagedTodos[stage.id] || [];
      const filteredStage = stageTodos.filter(todo => {
        if (selectedProject && todo.project_id !== selectedProject) return false;
        if (selectedAssignee && todo.assigned_to !== selectedAssignee) return false;
        return true;
      });
      filtered[stage.id] = filteredStage;
      count += filteredStage.length;
    }

    return { filteredStagedTodos: filtered, filteredPipelineCount: count };
  }, [allStagedTodos, selectedProject, selectedAssignee]);

  // ---- Move handler (used by both drag-drop and click-to-move) ----
  const handleMoveToStage = useCallback((todoId: string, targetStageId: string) => {
    onStatusChange(todoId, targetStageId);
  }, [onStatusChange]);

  // ---- Drag handlers ----
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const todoId = event.active.id as string;
    setActiveId(todoId);
    const draggedTodo = allPipelineTodos.find(t => t.id === todoId);
    if (draggedTodo) {
      setDragAnnouncement(`Picked up manuscript: ${draggedTodo.text}`);
    }
  }, [allPipelineTodos]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) {
      setDragAnnouncement('Manuscript dropped. No change.');
      return;
    }

    const todoId = active.id as string;
    const targetId = over.id as string;

    // Check if dropped on a stage column
    const stage = PIPELINE_STAGES.find(s => s.id === targetId);
    if (stage) {
      handleMoveToStage(todoId, stage.id);
      setDragAnnouncement(`Moved to ${stage.label}.`);
      return;
    }

    // Check if dropped on another card -- move to that card's stage
    for (const s of PIPELINE_STAGES) {
      const stageTodos = filteredStagedTodos[s.id] || [];
      if (stageTodos.some(t => t.id === targetId)) {
        handleMoveToStage(todoId, s.id);
        setDragAnnouncement(`Moved to ${s.label}.`);
        return;
      }
    }

    setDragAnnouncement('Manuscript dropped. No change.');
  }, [filteredStagedTodos, handleMoveToStage]);

  const activeTodo = activeId ? allPipelineTodos.find(t => t.id === activeId) : null;

  // ---- Determine which column the overlay is currently over ----
  const overColumnId = useMemo(() => {
    if (!overId) return null;
    // Direct column match
    if (PIPELINE_STAGES.some(s => s.id === overId)) return overId;
    // Card in a column
    for (const s of PIPELINE_STAGES) {
      const stageTodos = filteredStagedTodos[s.id] || [];
      if (stageTodos.some(t => t.id === overId)) return s.id;
    }
    return null;
  }, [overId, filteredStagedTodos]);

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Pipeline header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Manuscript Pipeline
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">
            {filteredPipelineCount} {filteredPipelineCount === 1 ? 'manuscript' : 'manuscripts'}
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-light)] hidden sm:block">
          Drag cards between stages or use &quot;Move to...&quot; on hover. Tag notes with [stage:name] for manual staging.
        </p>
      </div>

      {/* Summary stats */}
      {totalPipelineCount > 0 && (
        <SummaryStats stagedTodos={filteredStagedTodos} totalCount={filteredPipelineCount} />
      )}

      {/* Filter bar */}
      {totalPipelineCount > 0 && (availableProjects.length > 0 || availableAssignees.length > 0) && (
        <FilterBar
          projects={availableProjects}
          assignees={availableAssignees}
          selectedProject={selectedProject}
          selectedAssignee={selectedAssignee}
          onProjectChange={setSelectedProject}
          onAssigneeChange={setSelectedAssignee}
          filteredCount={filteredPipelineCount}
          totalCount={totalPipelineCount}
        />
      )}

      {/* Pipeline progress bar */}
      {filteredPipelineCount > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-[var(--surface-2)]">
          {PIPELINE_STAGES.map(stage => {
            const count = filteredStagedTodos[stage.id]?.length || 0;
            if (count === 0) return null;
            const widthPct = (count / filteredPipelineCount) * 100;
            return (
              <div
                key={stage.id}
                className="transition-all duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
                title={`${stage.label}: ${count}`}
              />
            );
          })}
        </div>
      )}

      {/* Stage flow indicator (arrow between stage labels) */}
      {totalPipelineCount > 0 && (
        <div className="hidden lg:flex items-center justify-center gap-1 py-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <React.Fragment key={stage.id}>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: stage.color, backgroundColor: stage.color + '12' }}
              >
                {stage.label}
              </span>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="w-3 h-3 text-[var(--text-light)]" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Screen reader announcements */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {dragAnnouncement}
      </div>

      {/* Horizontal scrollable pipeline with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.id} style={{ scrollSnapAlign: 'start' }}>
              <PipelineColumn
                stage={stage}
                todos={filteredStagedTodos[stage.id] || []}
                onTodoClick={onTodoClick}
                onMoveToStage={handleMoveToStage}
                isActiveDrag={!!activeId}
                isCurrentOver={overColumnId === stage.id}
              />
            </div>
          ))}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTodo && <DragOverlayCard todo={activeTodo} />}
        </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {totalPipelineCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-light)]">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 opacity-30" />
          </div>
          <p className="text-sm font-medium mb-2">No manuscripts in the pipeline</p>
          <p className="text-xs text-center max-w-md leading-relaxed">
            Tasks with writing, submission, or revision keywords will appear here automatically.
            You can also tag any task by adding <code className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--foreground)] text-[10px]">[stage:writing]</code> to its notes.
          </p>
          <div className="flex items-center gap-2 mt-4 text-[10px]">
            <span>Available stages:</span>
            {PIPELINE_STAGES.map((stage, i) => (
              <React.Fragment key={stage.id}>
                <span style={{ color: stage.color }}>{stage.label}</span>
                {i < PIPELINE_STAGES.length - 1 && <span className="text-[var(--text-light)]">/</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Filtered-to-zero state (filters active but no results) */}
      {totalPipelineCount > 0 && filteredPipelineCount === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--text-light)]">
          <Filter className="w-8 h-8 mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">No manuscripts match the current filters</p>
          <button
            onClick={() => {
              setSelectedProject(null);
              setSelectedAssignee(null);
            }}
            className="mt-2 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
