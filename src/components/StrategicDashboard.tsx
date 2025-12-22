'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  TrendingUp,
  Users,
  Award,
  Settings,
  Megaphone,
  Shield,
  Edit3,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Pause,
  XCircle,
  BarChart3,
} from 'lucide-react';
import {
  StrategicGoal,
  GoalCategory,
  GoalMilestone,
  GoalStatus,
  GoalPriority,
  GOAL_STATUS_CONFIG,
  GOAL_PRIORITY_CONFIG,
} from '@/types/todo';

interface StrategicDashboardProps {
  userName: string;
  darkMode?: boolean;
  onClose: () => void;
}

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="w-5 h-5" />,
  'users': <Users className="w-5 h-5" />,
  'award': <Award className="w-5 h-5" />,
  'settings': <Settings className="w-5 h-5" />,
  'megaphone': <Megaphone className="w-5 h-5" />,
  'shield': <Shield className="w-5 h-5" />,
  'target': <Target className="w-5 h-5" />,
};

// Status icons
const statusIcons: Record<GoalStatus, React.ReactNode> = {
  not_started: <Circle className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4" />,
  on_hold: <Pause className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

export default function StrategicDashboard({
  userName,
  darkMode = true,
  onClose,
}: StrategicDashboardProps) {
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddGoal, setShowAddGoal] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<StrategicGoal | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    priority: 'medium' as GoalPriority,
    target_date: '',
    target_value: '',
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesRes, goalsRes] = await Promise.all([
        fetch(`/api/goals/categories?userName=${encodeURIComponent(userName)}`),
        fetch(`/api/goals?userName=${encodeURIComponent(userName)}`),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
        // Expand all categories by default
        setExpandedCategories(new Set(categoriesData.map((c: GoalCategory) => c.id)));
      }

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        setGoals(goalsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [userName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Create a new goal
  const handleCreateGoal = async (categoryId: string) => {
    if (!newGoal.title.trim()) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newGoal,
          category_id: categoryId,
          created_by: userName,
        }),
      });

      if (res.ok) {
        const goal = await res.json();
        setGoals(prev => [...prev, goal]);
        setNewGoal({
          title: '',
          description: '',
          priority: 'medium',
          target_date: '',
          target_value: '',
        });
        setShowAddGoal(null);
      }
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  // Update a goal
  const handleUpdateGoal = async (goalId: string, updates: Partial<StrategicGoal>) => {
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goalId,
          ...updates,
          updated_by: userName,
        }),
      });

      if (res.ok) {
        const updatedGoal = await res.json();
        setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
        setEditingGoal(null);
      }
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  // Delete a goal
  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const res = await fetch(`/api/goals?id=${goalId}&userName=${encodeURIComponent(userName)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== goalId));
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  // Toggle milestone completion
  const handleToggleMilestone = async (milestone: GoalMilestone) => {
    try {
      const res = await fetch('/api/goals/milestones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: milestone.id,
          completed: !milestone.completed,
          userName,
        }),
      });

      if (res.ok) {
        // Refresh goals to get updated progress
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling milestone:', error);
    }
  };

  // Add milestone
  const handleAddMilestone = async (goalId: string, title: string) => {
    try {
      const res = await fetch('/api/goals/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goalId,
          title,
          userName,
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error adding milestone:', error);
    }
  };

  // Get goals by category
  const getGoalsByCategory = (categoryId: string) => {
    return goals.filter(g => g.category_id === categoryId);
  };

  // Get uncategorized goals
  const uncategorizedGoals = goals.filter(g => !g.category_id);

  // Calculate stats
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const inProgressGoals = goals.filter(g => g.status === 'in_progress').length;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className={`p-8 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
          <div className="animate-spin w-8 h-8 border-4 border-[#0033A0] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-4 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className={`w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden ${
          darkMode ? 'bg-slate-900' : 'bg-slate-50'
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 px-6 py-4 border-b ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#0033A0] to-[#D4A853]">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Strategic Goals
                </h1>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Long-term planning for your agency
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-4">
            <div className={`flex-1 p-3 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0033A0]" />
                <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Total Goals
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {totalGoals}
              </p>
            </div>
            <div className={`flex-1 p-3 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4A853]" />
                <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  In Progress
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {inProgressGoals}
              </p>
            </div>
            <div className={`flex-1 p-3 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Completed
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {completedGoals}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {categories.map(category => {
            const categoryGoals = getGoalsByCategory(category.id);
            const isExpanded = expandedCategories.has(category.id);

            return (
              <div
                key={category.id}
                className={`rounded-xl overflow-hidden border-2 ${
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${
                    darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      <span style={{ color: category.color }}>
                        {categoryIcons[category.icon] || <Target className="w-5 h-5" />}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                        {category.name}
                      </h3>
                      <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {categoryGoals.length} goal{categoryGoals.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddGoal(category.id);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        darkMode
                          ? 'hover:bg-slate-600 text-slate-400 hover:text-white'
                          : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {isExpanded ? (
                      <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    ) : (
                      <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    )}
                  </div>
                </button>

                {/* Goals list */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        {/* Add goal form */}
                        {showAddGoal === category.id && (
                          <div className={`p-4 border-b ${darkMode ? 'border-slate-700 bg-slate-700/30' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={newGoal.title}
                                onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Goal title..."
                                className={`w-full px-4 py-2 rounded-lg border text-sm ${
                                  darkMode
                                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                                autoFocus
                              />
                              <textarea
                                value={newGoal.description}
                                onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description (optional)..."
                                rows={2}
                                className={`w-full px-4 py-2 rounded-lg border text-sm resize-none ${
                                  darkMode
                                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                              />
                              <div className="flex gap-3">
                                <select
                                  value={newGoal.priority}
                                  onChange={(e) => setNewGoal(prev => ({ ...prev, priority: e.target.value as GoalPriority }))}
                                  className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                                    darkMode
                                      ? 'bg-slate-700 border-slate-600 text-white'
                                      : 'bg-white border-slate-300 text-slate-800'
                                  } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                                >
                                  <option value="low">Low Priority</option>
                                  <option value="medium">Medium Priority</option>
                                  <option value="high">High Priority</option>
                                  <option value="critical">Critical Priority</option>
                                </select>
                                <input
                                  type="date"
                                  value={newGoal.target_date}
                                  onChange={(e) => setNewGoal(prev => ({ ...prev, target_date: e.target.value }))}
                                  className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                                    darkMode
                                      ? 'bg-slate-700 border-slate-600 text-white'
                                      : 'bg-white border-slate-300 text-slate-800'
                                  } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                                />
                              </div>
                              <input
                                type="text"
                                value={newGoal.target_value}
                                onChange={(e) => setNewGoal(prev => ({ ...prev, target_value: e.target.value }))}
                                placeholder="Target value (e.g., $1M revenue, 50 new clients)..."
                                className={`w-full px-4 py-2 rounded-lg border text-sm ${
                                  darkMode
                                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCreateGoal(category.id)}
                                  disabled={!newGoal.title.trim()}
                                  className="px-4 py-2 bg-[#0033A0] text-white text-sm font-medium rounded-lg hover:bg-[#002878] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Add Goal
                                </button>
                                <button
                                  onClick={() => {
                                    setShowAddGoal(null);
                                    setNewGoal({
                                      title: '',
                                      description: '',
                                      priority: 'medium',
                                      target_date: '',
                                      target_value: '',
                                    });
                                  }}
                                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                                    darkMode
                                      ? 'text-slate-300 hover:bg-slate-600'
                                      : 'text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Goals */}
                        {categoryGoals.length === 0 && showAddGoal !== category.id ? (
                          <div className={`p-8 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No goals in this category yet</p>
                            <button
                              onClick={() => setShowAddGoal(category.id)}
                              className="mt-2 text-[#0033A0] text-sm font-medium hover:underline"
                            >
                              Add your first goal
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-700/50">
                            {categoryGoals.map(goal => (
                              <GoalCard
                                key={goal.id}
                                goal={goal}
                                darkMode={darkMode}
                                onEdit={() => setEditingGoal(goal)}
                                onDelete={() => handleDeleteGoal(goal.id)}
                                onStatusChange={(status) => handleUpdateGoal(goal.id, { status })}
                                onToggleMilestone={handleToggleMilestone}
                                onAddMilestone={(title) => handleAddMilestone(goal.id, title)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Uncategorized goals */}
          {uncategorizedGoals.length > 0 && (
            <div className={`rounded-xl overflow-hidden border-2 ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className="p-4">
                <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Uncategorized
                </h3>
              </div>
              <div className={`border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="divide-y divide-slate-700/50">
                  {uncategorizedGoals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      darkMode={darkMode}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => handleDeleteGoal(goal.id)}
                      onStatusChange={(status) => handleUpdateGoal(goal.id, { status })}
                      onToggleMilestone={handleToggleMilestone}
                      onAddMilestone={(title) => handleAddMilestone(goal.id, title)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Goal Modal */}
        <AnimatePresence>
          {editingGoal && (
            <EditGoalModal
              goal={editingGoal}
              categories={categories}
              darkMode={darkMode}
              onClose={() => setEditingGoal(null)}
              onSave={(updates) => handleUpdateGoal(editingGoal.id, updates)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Goal Card Component
interface GoalCardProps {
  goal: StrategicGoal;
  darkMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: GoalStatus) => void;
  onToggleMilestone: (milestone: GoalMilestone) => void;
  onAddMilestone: (title: string) => void;
}

function GoalCard({
  goal,
  darkMode,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleMilestone,
  onAddMilestone,
}: GoalCardProps) {
  const [showMilestones, setShowMilestones] = useState(false);
  const [newMilestone, setNewMilestone] = useState('');

  const statusConfig = GOAL_STATUS_CONFIG[goal.status];
  const priorityConfig = GOAL_PRIORITY_CONFIG[goal.priority];
  const milestones = goal.milestones || [];

  return (
    <div className={`p-4 ${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
      <div className="flex items-start gap-4">
        {/* Status selector */}
        <div className="relative group">
          <button
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
          >
            {statusIcons[goal.status]}
          </button>
          <div className={`absolute left-0 top-full mt-1 py-1 rounded-lg shadow-xl border z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all ${
            darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'
          }`}>
            {(Object.keys(GOAL_STATUS_CONFIG) as GoalStatus[]).map(status => (
              <button
                key={status}
                onClick={() => onStatusChange(status)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  darkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-100'
                }`}
                style={{ color: GOAL_STATUS_CONFIG[status].color }}
              >
                {statusIcons[status]}
                {GOAL_STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`font-medium ${
                goal.status === 'completed'
                  ? 'line-through opacity-60'
                  : darkMode ? 'text-white' : 'text-slate-800'
              }`}>
                {goal.title}
              </h4>
              {goal.description && (
                <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {goal.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                }`}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-red-900/30 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-500 hover:text-red-500'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
            >
              {priorityConfig.label}
            </span>
            {goal.target_date && (
              <span className={`flex items-center gap-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Calendar className="w-3 h-3" />
                {new Date(goal.target_date).toLocaleDateString()}
              </span>
            )}
            {goal.target_value && (
              <span className={`text-xs font-medium ${darkMode ? 'text-[#D4A853]' : 'text-[#0033A0]'}`}>
                Target: {goal.target_value}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {goal.progress_percent > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Progress</span>
                <span className={darkMode ? 'text-white' : 'text-slate-800'}>{goal.progress_percent}%</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0033A0] to-[#D4A853] transition-all"
                  style={{ width: `${goal.progress_percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="mt-3">
            <button
              onClick={() => setShowMilestones(!showMilestones)}
              className={`flex items-center gap-1 text-xs font-medium ${
                darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {showMilestones ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {milestones.length} milestone{milestones.length !== 1 ? 's' : ''}
            </button>

            <AnimatePresence>
              {showMilestones && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1">
                    {milestones.map(milestone => (
                      <div
                        key={milestone.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          darkMode ? 'bg-slate-700/50' : 'bg-slate-100'
                        }`}
                      >
                        <button
                          onClick={() => onToggleMilestone(milestone)}
                          className={milestone.completed ? 'text-green-500' : darkMode ? 'text-slate-400' : 'text-slate-400'}
                        >
                          {milestone.completed ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <span className={`flex-1 text-sm ${
                          milestone.completed
                            ? 'line-through opacity-60'
                            : darkMode ? 'text-white' : 'text-slate-800'
                        }`}>
                          {milestone.title}
                        </span>
                      </div>
                    ))}

                    {/* Add milestone */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newMilestone}
                        onChange={(e) => setNewMilestone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newMilestone.trim()) {
                            onAddMilestone(newMilestone.trim());
                            setNewMilestone('');
                          }
                        }}
                        placeholder="Add milestone..."
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${
                          darkMode
                            ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                            : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                        } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                      />
                      <button
                        onClick={() => {
                          if (newMilestone.trim()) {
                            onAddMilestone(newMilestone.trim());
                            setNewMilestone('');
                          }
                        }}
                        disabled={!newMilestone.trim()}
                        className="px-3 py-1.5 bg-[#0033A0] text-white text-sm rounded-lg hover:bg-[#002878] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Goal Modal
interface EditGoalModalProps {
  goal: StrategicGoal;
  categories: GoalCategory[];
  darkMode: boolean;
  onClose: () => void;
  onSave: (updates: Partial<StrategicGoal>) => void;
}

function EditGoalModal({ goal, categories, darkMode, onClose, onSave }: EditGoalModalProps) {
  const [formData, setFormData] = useState({
    title: goal.title,
    description: goal.description || '',
    category_id: goal.category_id || '',
    status: goal.status,
    priority: goal.priority,
    target_date: goal.target_date?.split('T')[0] || '',
    target_value: goal.target_value || '',
    current_value: goal.current_value || '',
    notes: goal.notes || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ${
          darkMode ? 'bg-slate-800' : 'bg-white'
        }`}
      >
        <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Edit Goal
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={`w-full px-4 py-2 rounded-lg border ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-800'
              } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={`w-full px-4 py-2 rounded-lg border resize-none ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-800'
              } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                <option value="">No Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as GoalStatus }))}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                {(Object.keys(GOAL_STATUS_CONFIG) as GoalStatus[]).map(status => (
                  <option key={status} value={status}>{GOAL_STATUS_CONFIG[status].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as GoalPriority }))}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                {(Object.keys(GOAL_PRIORITY_CONFIG) as GoalPriority[]).map(priority => (
                  <option key={priority} value={priority}>{GOAL_PRIORITY_CONFIG[priority].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Target Date
              </label>
              <input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Target Value
              </label>
              <input
                type="text"
                value={formData.target_value}
                onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                placeholder="e.g., $1M revenue"
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Current Value
              </label>
              <input
                type="text"
                value={formData.current_value}
                onChange={(e) => setFormData(prev => ({ ...prev, current_value: e.target.value }))}
                placeholder="e.g., $500K"
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Additional notes..."
              className={`w-full px-4 py-2 rounded-lg border resize-none ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
            />
          </div>
        </div>

        <div className={`sticky bottom-0 flex items-center justify-end gap-3 p-4 border-t ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg transition-colors ${
              darkMode
                ? 'text-slate-300 hover:bg-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                title: formData.title,
                description: formData.description || null,
                category_id: formData.category_id || null,
                status: formData.status,
                priority: formData.priority,
                target_date: formData.target_date || null,
                target_value: formData.target_value || null,
                current_value: formData.current_value || null,
                notes: formData.notes || null,
              } as Partial<StrategicGoal>);
            }}
            className="px-4 py-2 bg-[#0033A0] text-white font-medium rounded-lg hover:bg-[#002878] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
