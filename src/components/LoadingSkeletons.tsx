'use client';

/**
 * Loading skeleton components for lazy-loaded features.
 * These provide visual feedback while the actual components are being loaded.
 */

interface SkeletonProps {
  darkMode?: boolean;
}

/**
 * Loading skeleton for ChatPanel
 * Displays a simplified chat interface placeholder
 */
export function ChatPanelSkeleton({ darkMode = true }: SkeletonProps) {
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const pulseClass = darkMode ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <div className={`fixed bottom-4 right-4 w-80 h-96 ${bgClass} rounded-xl shadow-2xl border ${borderClass} flex flex-col overflow-hidden z-50`}>
      {/* Header skeleton */}
      <div className={`p-3 border-b ${borderClass} flex items-center gap-3`}>
        <div className={`w-8 h-8 rounded-full ${pulseClass} animate-pulse`} />
        <div className="flex-1">
          <div className={`h-4 w-24 ${pulseClass} rounded animate-pulse`} />
        </div>
        <div className={`w-6 h-6 ${pulseClass} rounded animate-pulse`} />
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 p-3 space-y-3 overflow-hidden">
        <div className="flex gap-2">
          <div className={`w-6 h-6 rounded-full ${pulseClass} animate-pulse`} />
          <div className={`h-12 w-48 ${pulseClass} rounded-lg animate-pulse`} />
        </div>
        <div className="flex gap-2 justify-end">
          <div className={`h-10 w-40 ${pulseClass} rounded-lg animate-pulse`} />
        </div>
        <div className="flex gap-2">
          <div className={`w-6 h-6 rounded-full ${pulseClass} animate-pulse`} />
          <div className={`h-8 w-32 ${pulseClass} rounded-lg animate-pulse`} />
        </div>
      </div>

      {/* Input skeleton */}
      <div className={`p-3 border-t ${borderClass}`}>
        <div className={`h-10 w-full ${pulseClass} rounded-lg animate-pulse`} />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for StrategicDashboard
 * Displays a full-screen modal placeholder with goal cards
 */
export function StrategicDashboardSkeleton({ darkMode = true }: SkeletonProps) {
  const bgClass = darkMode ? 'bg-slate-900' : 'bg-slate-50';
  const cardClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const pulseClass = darkMode ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <div className={`fixed inset-0 ${bgClass} z-50 flex flex-col`}>
      {/* Header skeleton */}
      <div className={`${cardClass} p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto flex items-center justify-between">
          <div className={`h-8 w-48 ${pulseClass} rounded animate-pulse`} />
          <div className={`h-8 w-8 ${pulseClass} rounded animate-pulse`} />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${cardClass} p-4 rounded-xl`}>
                <div className={`h-4 w-20 ${pulseClass} rounded animate-pulse mb-2`} />
                <div className={`h-8 w-12 ${pulseClass} rounded animate-pulse`} />
              </div>
            ))}
          </div>

          {/* Goal cards skeleton */}
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${cardClass} p-4 rounded-xl`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-6 w-40 ${pulseClass} rounded animate-pulse`} />
                  <div className={`h-6 w-16 ${pulseClass} rounded-full animate-pulse`} />
                </div>
                <div className={`h-4 w-full ${pulseClass} rounded animate-pulse mb-2`} />
                <div className={`h-4 w-3/4 ${pulseClass} rounded animate-pulse mb-4`} />
                <div className={`h-2 w-full ${pulseClass} rounded-full animate-pulse`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for ActivityFeed
 * Displays a sidebar panel placeholder with activity items
 */
export function ActivityFeedSkeleton({ darkMode = true }: SkeletonProps) {
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const pulseClass = darkMode ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <div className={`w-full max-w-md h-full ${bgClass} flex flex-col`}>
      {/* Header skeleton */}
      <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className={`h-6 w-32 ${pulseClass} rounded animate-pulse`} />
          <div className={`h-6 w-6 ${pulseClass} rounded animate-pulse`} />
        </div>
      </div>

      {/* Activity items skeleton */}
      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-3">
            <div className={`w-8 h-8 rounded-full ${pulseClass} animate-pulse flex-shrink-0`} />
            <div className="flex-1">
              <div className={`h-4 w-3/4 ${pulseClass} rounded animate-pulse mb-2`} />
              <div className={`h-3 w-1/2 ${pulseClass} rounded animate-pulse`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for WeeklyProgressChart
 * Displays a modal placeholder with chart bars
 */
export function WeeklyProgressChartSkeleton({ darkMode = true }: SkeletonProps) {
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const pulseClass = darkMode ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50`}>
      <div className={`${bgClass} rounded-xl p-6 w-full max-w-lg mx-4`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className={`h-6 w-40 ${pulseClass} rounded animate-pulse`} />
          <div className={`h-6 w-6 ${pulseClass} rounded animate-pulse`} />
        </div>

        {/* Chart bars skeleton */}
        <div className="flex items-end justify-between gap-2 h-40 mb-4">
          {[40, 65, 30, 80, 55, 70, 45].map((height, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className={`w-full ${pulseClass} rounded-t animate-pulse`}
                style={{ height: `${height}%` }}
              />
              <div className={`h-3 w-6 ${pulseClass} rounded animate-pulse`} />
            </div>
          ))}
        </div>

        {/* Legend skeleton */}
        <div className="flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 ${pulseClass} rounded animate-pulse`} />
            <div className={`h-3 w-16 ${pulseClass} rounded animate-pulse`} />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 ${pulseClass} rounded animate-pulse`} />
            <div className={`h-3 w-16 ${pulseClass} rounded animate-pulse`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for AIInbox
 * Displays a full-page inbox placeholder
 */
export function AIInboxSkeleton({ darkMode = true }: SkeletonProps) {
  const bgClass = darkMode ? 'bg-[var(--background)]' : 'bg-[var(--background)]';
  const cardClass = darkMode ? 'bg-[var(--surface)]' : 'bg-[var(--surface)]';
  const pulseClass = darkMode ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface-2)]';
  const borderClass = darkMode ? 'border-white/10' : 'border-[var(--border)]';

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
      {/* Header skeleton */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${borderClass}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${pulseClass} animate-pulse`} />
          <div>
            <div className={`h-5 w-24 ${pulseClass} rounded animate-pulse mb-1`} />
            <div className={`h-3 w-32 ${pulseClass} rounded animate-pulse`} />
          </div>
        </div>
        <div className={`w-9 h-9 ${pulseClass} rounded-lg animate-pulse`} />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Category card skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            {/* Category header */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${cardClass}`}>
              <div className={`w-8 h-8 rounded-lg ${pulseClass} animate-pulse`} />
              <div className="flex-1">
                <div className={`h-4 w-32 ${pulseClass} rounded animate-pulse mb-1`} />
                <div className={`h-3 w-48 ${pulseClass} rounded animate-pulse`} />
              </div>
              <div className={`h-6 w-8 ${pulseClass} rounded-full animate-pulse`} />
              <div className={`w-5 h-5 ${pulseClass} rounded animate-pulse`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for DashboardModal
 * Displays a modal placeholder with stats and task previews
 */
export function DashboardModalSkeleton({ darkMode = true }: SkeletonProps) {
  const bgClass = darkMode ? 'bg-slate-900' : 'bg-white';
  const cardClass = darkMode ? 'bg-slate-800' : 'bg-slate-50';
  const pulseClass = darkMode ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`${bgClass} rounded-2xl p-6 w-full max-w-md mx-4`}>
        {/* Greeting skeleton */}
        <div className="text-center mb-6">
          <div className={`h-4 w-24 ${pulseClass} rounded animate-pulse mx-auto mb-2`} />
          <div className={`h-8 w-48 ${pulseClass} rounded animate-pulse mx-auto mb-1`} />
          <div className={`h-4 w-32 ${pulseClass} rounded animate-pulse mx-auto`} />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardClass} p-3 rounded-xl`}>
              <div className={`h-8 w-8 ${pulseClass} rounded animate-pulse mb-2`} />
              <div className={`h-6 w-12 ${pulseClass} rounded animate-pulse mb-1`} />
              <div className={`h-3 w-20 ${pulseClass} rounded animate-pulse`} />
            </div>
          ))}
        </div>

        {/* Task preview skeleton */}
        <div className={`${cardClass} p-4 rounded-xl mb-4`}>
          <div className={`h-4 w-24 ${pulseClass} rounded animate-pulse mb-3`} />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className={`w-4 h-4 ${pulseClass} rounded animate-pulse`} />
              <div className={`h-4 flex-1 ${pulseClass} rounded animate-pulse`} />
            </div>
          ))}
        </div>

        {/* Action button skeleton */}
        <div className={`h-12 w-full ${pulseClass} rounded-xl animate-pulse`} />
      </div>
    </div>
  );
}
