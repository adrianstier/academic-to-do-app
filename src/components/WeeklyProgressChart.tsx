'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, X, Target, Sparkles } from 'lucide-react';
import { Todo } from '@/types/todo';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import CountUp from '@/components/ui/CountUp';

interface WeeklyProgressChartProps {
  todos: Todo[];
  darkMode?: boolean;
  show: boolean;
  onClose: () => void;
  dailyGoal?: number;
}

interface DayData {
  day: string;
  shortDay: string;
  date: Date;
  completed: number;
  created: number;
}

export default function WeeklyProgressChart({
  todos,
  darkMode = true,
  show,
  onClose,
  dailyGoal = 5,
}: WeeklyProgressChartProps) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Close on Escape key press
  useEscapeKey(onClose, { enabled: show });

  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DayData[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get last 5 weekdays (Mon-Fri)
    const cursor = new Date(today);
    while (days.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        const date = new Date(cursor);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Count tasks completed on this day (based on updated_at if completed)
        const completed = todos.filter(t => {
          if (!t.completed) return false;
          const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
          return updatedAt >= dayStart && updatedAt <= dayEnd;
        }).length;

        // Count tasks created on this day
        const created = todos.filter(t => {
          const createdAt = new Date(t.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        }).length;

        days.push({
          day: dayNames[date.getDay()],
          shortDay: dayNames[date.getDay()],
          date,
          completed,
          created,
        });
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return days.reverse();
  }, [todos]);

  const stats = useMemo(() => {
    const totalCompleted = weekData.reduce((sum, d) => sum + d.completed, 0);
    const totalCreated = weekData.reduce((sum, d) => sum + d.created, 0);
    const maxCompleted = Math.max(...weekData.map(d => d.completed), dailyGoal);

    // Calculate trend (compare last 3 days to previous 4)
    const recentCompleted = weekData.slice(-3).reduce((sum, d) => sum + d.completed, 0);
    const earlierCompleted = weekData.slice(0, 4).reduce((sum, d) => sum + d.completed, 0);
    const avgRecent = recentCompleted / 2;
    const avgEarlier = earlierCompleted / 3;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (avgRecent > avgEarlier * 1.2) trend = 'up';
    else if (avgRecent < avgEarlier * 0.8) trend = 'down';

    const completionRate = totalCreated > 0
      ? Math.round((totalCompleted / totalCreated) * 100)
      : 0;

    const daysMetGoal = weekData.filter(d => d.completed >= dailyGoal).length;

    return {
      totalCompleted,
      totalCreated,
      maxCompleted,
      trend,
      completionRate,
      avgPerDay: (totalCompleted / 5).toFixed(1),
      daysMetGoal,
    };
  }, [weekData, dailyGoal]);

  if (!show) return null;

  const goalLinePosition = stats.maxCompleted > 0
    ? ((dailyGoal / stats.maxCompleted) * 96)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          darkMode ? 'bg-[#0A1628]' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          darkMode ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              darkMode ? 'bg-[#0033A0]/20' : 'bg-[#0033A0]/10'
            }`}>
              <TrendingUp className="w-4 h-4 text-[#0033A0]" />
            </div>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Weekly Progress
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats row */}
        <div className={`grid grid-cols-3 gap-4 p-4 border-b ${
          darkMode ? 'border-white/10' : 'border-slate-200'
        }`}>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-2xl font-bold text-[#0033A0]">
              <CountUp end={stats.totalCompleted} duration={800} />
            </p>
            <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-slate-500'}`}>Completed</p>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              {stats.avgPerDay}
            </p>
            <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-slate-500'}`}>Avg/Day</p>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-1">
              <p className={`text-2xl font-bold ${
                stats.trend === 'up' ? 'text-emerald-500' :
                stats.trend === 'down' ? 'text-red-500' :
                darkMode ? 'text-white' : 'text-slate-800'
              }`}>
                <CountUp end={stats.completionRate} duration={800} suffix="%" />
              </p>
              {stats.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
              {stats.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
              {stats.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
            </div>
            <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-slate-500'}`}>Rate</p>
          </motion.div>
        </div>

        {/* Chart */}
        <div className="p-4 relative">
          {/* Goal line */}
          {dailyGoal > 0 && stats.maxCompleted >= dailyGoal && (
            <div
              className="absolute left-4 right-4 flex items-center z-10 pointer-events-none"
              style={{ bottom: `${goalLinePosition + 56}px` }}
            >
              <div className={`flex-1 border-t-2 border-dashed ${
                darkMode ? 'border-emerald-500/40' : 'border-emerald-500/30'
              }`} />
              <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <Target className="w-3 h-3 inline mr-1" />
                Goal: {dailyGoal}
              </span>
            </div>
          )}

          <div className="flex items-end justify-between gap-3 h-32 mb-2">
            {weekData.map((day, index) => {
              // Calculate height in pixels (max container height is 128px / 8rem)
              const maxBarHeight = 96; // Leave room for label
              const barHeight = stats.maxCompleted > 0
                ? Math.max((day.completed / stats.maxCompleted) * maxBarHeight, day.completed > 0 ? 8 : 4)
                : 4;
              const isToday = index === weekData.length - 1;
              const isHovered = hoveredDay === index;
              const metGoal = day.completed >= dailyGoal;

              return (
                <div
                  key={day.day}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full relative"
                  onMouseEnter={() => setHoveredDay(index)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Tooltip */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className={`absolute bottom-full mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-20 ${
                          darkMode
                            ? 'bg-white/10 backdrop-blur-md border border-white/10'
                            : 'bg-slate-800 text-white'
                        }`}
                      >
                        <p className="font-semibold">{day.day}</p>
                        <p className={darkMode ? 'text-white/70' : 'text-white/70'}>
                          {day.completed} completed
                        </p>
                        <p className={darkMode ? 'text-white/50' : 'text-white/50'}>
                          {day.created} created
                        </p>
                        {metGoal && (
                          <p className="text-emerald-400 mt-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Goal met!
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Count label */}
                  <motion.span
                    className={`text-xs font-medium transition-colors ${
                      isHovered
                        ? 'text-[#0033A0]'
                        : day.completed > 0
                          ? 'text-[#0033A0]/80'
                          : darkMode ? 'text-white/30' : 'text-slate-400'
                    }`}
                    animate={{ scale: isHovered ? 1.1 : 1 }}
                  >
                    {day.completed}
                  </motion.span>

                  {/* Bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{
                      height: barHeight,
                      scale: isHovered ? 1.05 : 1,
                    }}
                    transition={{
                      height: { delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
                      scale: { duration: 0.15 }
                    }}
                    className={`w-full rounded-t-lg cursor-pointer transition-colors ${
                      isToday
                        ? metGoal
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                          : 'bg-gradient-to-t from-[#0033A0] to-[#0047CC]'
                        : day.completed > 0
                          ? metGoal
                            ? darkMode ? 'bg-emerald-500/40' : 'bg-emerald-500/30'
                            : darkMode ? 'bg-[#0033A0]/60' : 'bg-[#0033A0]/40'
                          : darkMode ? 'bg-white/10' : 'bg-slate-200'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Day labels */}
          <div className="flex justify-between">
            {weekData.map((day, index) => {
              const isToday = index === weekData.length - 1;
              const isHovered = hoveredDay === index;
              return (
                <div key={day.day} className="flex-1 text-center">
                  <span className={`text-xs font-medium transition-colors ${
                    isHovered
                      ? 'text-[#0033A0]'
                      : isToday
                        ? 'text-[#0033A0]'
                        : darkMode ? 'text-white/40' : 'text-slate-500'
                  }`}>
                    {day.shortDay}
                  </span>
                  {isToday && (
                    <div className="flex justify-center mt-1">
                      <div className="w-1 h-1 rounded-full bg-[#0033A0]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Goal progress */}
        <div className={`mx-4 mb-2 p-3 rounded-xl ${
          darkMode ? 'bg-white/5' : 'bg-slate-50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${darkMode ? 'text-white/60' : 'text-slate-600'}`}>
              Days goal met
            </span>
            <span className={`text-xs font-semibold ${
              stats.daysMetGoal >= 4 ? 'text-emerald-500' :
              stats.daysMetGoal >= 2 ? 'text-amber-500' :
              darkMode ? 'text-white/40' : 'text-slate-400'
            }`}>
              {stats.daysMetGoal}/5
            </span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${
                  i < stats.daysMetGoal
                    ? 'bg-emerald-500'
                    : darkMode ? 'bg-white/10' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer tip */}
        <div className={`px-4 py-3 text-center text-xs ${
          darkMode ? 'bg-white/5 text-white/50' : 'bg-slate-50 text-slate-500'
        }`}>
          {stats.trend === 'up' && "Great job! You're completing more tasks than last week."}
          {stats.trend === 'down' && "Keep going! Consistency is key."}
          {stats.trend === 'stable' && "You're maintaining a steady pace!"}
        </div>
      </motion.div>
    </motion.div>
  );
}
