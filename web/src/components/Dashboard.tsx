'use client';

import { TaskStats } from '@/types/task';

interface DashboardProps {
  stats: TaskStats | null;
  onFilterClick: (filter: { status?: string; priority?: string; overdue?: boolean }) => void;
}

export default function Dashboard({ stats, onFilterClick }: DashboardProps) {
  if (!stats) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-4 h-20"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 bg-[#e6f0f9] rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#003B73]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 text-center border border-gray-200/50">
          <div className="w-10 h-10 bg-white rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500 font-medium">Total Tasks</div>
        </div>

        {/* Overdue */}
        <button
          onClick={() => onFilterClick({ overdue: true })}
          className={`rounded-xl p-4 text-center transition-all border ${
            stats.overdue > 0
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200/50 hover:shadow-md hover:scale-[1.02]'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200/50 hover:bg-gray-100'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm ${stats.overdue > 0 ? 'bg-red-500' : 'bg-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${stats.overdue > 0 ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {stats.overdue}
          </div>
          <div className={`text-xs font-medium ${stats.overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>
            Overdue
          </div>
        </button>

        {/* Due Today */}
        <div className={`bg-gradient-to-br rounded-xl p-4 text-center border ${stats.dueToday > 0 ? 'from-orange-50 to-orange-100 border-orange-200/50' : 'from-gray-50 to-gray-100 border-gray-200/50'}`}>
          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm ${stats.dueToday > 0 ? 'bg-orange-500' : 'bg-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${stats.dueToday > 0 ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className={`text-2xl font-bold ${stats.dueToday > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{stats.dueToday}</div>
          <div className={`text-xs font-medium ${stats.dueToday > 0 ? 'text-orange-500' : 'text-gray-500'}`}>Due Today</div>
        </div>

        {/* Due Soon (7 days) */}
        <div className={`bg-gradient-to-br rounded-xl p-4 text-center border ${stats.dueSoon > 0 ? 'from-amber-50 to-amber-100 border-amber-200/50' : 'from-gray-50 to-gray-100 border-gray-200/50'}`}>
          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm ${stats.dueSoon > 0 ? 'bg-amber-500' : 'bg-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${stats.dueSoon > 0 ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className={`text-2xl font-bold ${stats.dueSoon > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{stats.dueSoon}</div>
          <div className={`text-xs font-medium ${stats.dueSoon > 0 ? 'text-amber-500' : 'text-gray-500'}`}>Due Soon</div>
        </div>

        {/* To Do */}
        <button
          onClick={() => onFilterClick({ status: 'todo' })}
          className="bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 rounded-xl p-4 text-center transition-all border border-slate-200/50 hover:shadow-md hover:scale-[1.02]"
        >
          <div className="w-10 h-10 bg-slate-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-slate-700">{stats.byStatus.todo || 0}</div>
          <div className="text-xs text-slate-500 font-medium">To Do</div>
        </button>

        {/* In Progress */}
        <button
          onClick={() => onFilterClick({ status: 'in_progress' })}
          className="bg-gradient-to-br from-[#e6f0f9] to-[#cce1f3] hover:from-[#cce1f3] hover:to-[#99c3e7] rounded-xl p-4 text-center transition-all border border-[#0071CE]/20 hover:shadow-md hover:scale-[1.02]"
        >
          <div className="w-10 h-10 bg-[#0071CE] rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#003B73]">{stats.byStatus.in_progress || 0}</div>
          <div className="text-xs text-[#0071CE] font-medium">In Progress</div>
        </button>

        {/* Done */}
        <button
          onClick={() => onFilterClick({ status: 'done' })}
          className="bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-150 rounded-xl p-4 text-center transition-all border border-emerald-200/50 hover:shadow-md hover:scale-[1.02]"
        >
          <div className="w-10 h-10 bg-emerald-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.byStatus.done || 0}</div>
          <div className="text-xs text-emerald-500 font-medium">Done</div>
        </button>
      </div>

      {/* Priority & Assignee breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* By Priority */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            By Priority
          </h3>
          <div className="flex gap-3">
            <button
              onClick={() => onFilterClick({ priority: 'high' })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-sm text-gray-700 font-medium">{stats.byPriority.high || 0}</span>
            </button>
            <button
              onClick={() => onFilterClick({ priority: 'medium' })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-sm text-gray-700 font-medium">{stats.byPriority.medium || 0}</span>
            </button>
            <button
              onClick={() => onFilterClick({ priority: 'low' })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              <span className="text-sm text-gray-700 font-medium">{stats.byPriority.low || 0}</span>
            </button>
          </div>
        </div>

        {/* By Assignee */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            By Assignee
          </h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(stats.byAssignee).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0071CE] to-[#003B73] flex items-center justify-center text-white text-xs font-bold">
                  {name.charAt(0)}
                </div>
                <span className="text-sm text-gray-700 font-medium">{name}: {count}</span>
              </div>
            ))}
            {Object.keys(stats.byAssignee).length === 0 && (
              <span className="text-sm text-gray-400 italic">No assigned tasks</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
