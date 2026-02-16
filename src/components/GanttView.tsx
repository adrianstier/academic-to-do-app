'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, Calendar } from 'lucide-react';
import { useTodoStore } from '@/store/todoStore';
import type { Todo } from '@/types/todo';
import type { Project } from '@/types/project';

interface GanttViewProps { onTaskClick: (todo: Todo) => void; }
type ZoomLevel = 'week' | 'month' | 'quarter';
interface ProjectGroup { project: Project | null; todos: Todo[]; collapsed: boolean; }

const ROW_H = 36, HDR_H = 48, LEFT_W = 250, NO_COLOR = '#6b7280';
const DAY_W: Record<ZoomLevel, number> = { week: 40, month: 16, quarter: 5 };

function sod(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addD(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffD(a: Date, b: Date) { return Math.round((a.getTime() - b.getTime()) / 86400000); }

function fmtHdr(d: Date, z: ZoomLevel): string {
  if (z === 'week') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (z === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
}

function hdrTicks(start: Date, end: Date, z: ZoomLevel): Date[] {
  const ticks: Date[] = [], cur = new Date(start);
  if (z === 'week') {
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
    while (cur <= end) { ticks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }
  } else if (z === 'month') {
    cur.setDate(1);
    while (cur <= end) { ticks.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
  } else {
    cur.setDate(1); cur.setMonth(Math.floor(cur.getMonth() / 3) * 3);
    while (cur <= end) { ticks.push(new Date(cur)); cur.setMonth(cur.getMonth() + 3); }
  }
  return ticks;
}

function overdue(due?: string, done?: boolean) {
  if (!due || done) return false;
  return sod(new Date(due)) < sod(new Date());
}

type Row = { type: 'header'; group: ProjectGroup; key: string } | { type: 'task'; todo: Todo; color: string };

export default function GanttView({ onTaskClick }: GanttViewProps) {
  const todos = useTodoStore((s) => s.todos);
  const projects = useTodoStore((s) => s.projects);
  const deps = useTodoStore((s) => s.dependencies);
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef(false);

  const handleScroll = useCallback((src: 'left' | 'right') => {
    if (syncRef.current) return;
    syncRef.current = true;
    const from = src === 'left' ? leftRef.current : rightRef.current;
    const to = src === 'left' ? rightRef.current : leftRef.current;
    if (from && to) to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => { syncRef.current = false; });
  }, []);

  const pMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const groups: ProjectGroup[] = useMemo(() => {
    const bk = new Map<string, Todo[]>();
    todos.forEach((t) => { const k = t.project_id || '__none__'; if (!bk.has(k)) bk.set(k, []); bk.get(k)!.push(t); });
    const res: ProjectGroup[] = [];
    const sIds = [...bk.keys()].filter((k) => k !== '__none__').sort((a, b) => (pMap.get(a)?.name || '').localeCompare(pMap.get(b)?.name || ''));
    sIds.forEach((pid) => res.push({ project: pMap.get(pid) || null, todos: bk.get(pid)!.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')), collapsed: collapsed[pid] ?? false }));
    if (bk.has('__none__')) res.push({ project: null, todos: bk.get('__none__')!.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')), collapsed: collapsed['__none__'] ?? false });
    return res;
  }, [todos, pMap, collapsed]);

  const { tlStart, tlEnd, dw } = useMemo(() => {
    const now = sod(new Date());
    let earliest = addD(now, -14), latest = addD(now, 30);
    todos.forEach((t) => {
      if (t.created_at) { const d = sod(new Date(t.created_at)); if (d < earliest) earliest = d; }
      if (t.due_date) { const d = sod(new Date(t.due_date)); if (d > latest) latest = d; }
      if (t.start_date) { const d = sod(new Date(t.start_date)); if (d < earliest) earliest = d; }
    });
    projects.forEach((p) => {
      if (p.start_date) { const d = sod(new Date(p.start_date)); if (d < earliest) earliest = d; }
      if (p.end_date) { const d = sod(new Date(p.end_date)); if (d > latest) latest = d; }
    });
    return { tlStart: addD(earliest, -7), tlEnd: addD(latest, 14), dw: DAY_W[zoom] };
  }, [todos, projects, zoom]);

  const tlW = diffD(tlEnd, tlStart) * dw;
  const todayX = diffD(sod(new Date()), tlStart) * dw;

  useEffect(() => {
    if (rightRef.current) rightRef.current.scrollLeft = Math.max(0, todayX - rightRef.current.clientWidth / 3);
  }, [todayX, zoom]);

  const ticks = useMemo(() => hdrTicks(tlStart, tlEnd, zoom), [tlStart, tlEnd, zoom]);
  const toggle = useCallback((k: string) => setCollapsed((p) => ({ ...p, [k]: !p[k] })), []);

  // Flat row list
  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    groups.forEach((g) => {
      const k = g.project?.id || '__none__';
      r.push({ type: 'header', group: g, key: k });
      if (!g.collapsed) g.todos.forEach((t) => r.push({ type: 'task', todo: t, color: g.project?.color || NO_COLOR }));
    });
    return r;
  }, [groups]);

  // Todo row index map for dependency lines
  const rowIdx = useMemo(() => {
    const m = new Map<string, number>(); let i = 0;
    rows.forEach((r) => { if (r.type === 'task') m.set(r.todo.id, i); i++; });
    return m;
  }, [rows]);

  // Dependency lines
  const depLines = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    Object.entries(deps).forEach(([tid, dep]) => {
      const fi = rowIdx.get(tid);
      if (fi === undefined) return;
      const ft = todos.find((t) => t.id === tid);
      if (!ft) return;
      dep.blockedBy.forEach((b) => {
        const bi = rowIdx.get(b.blocker_id);
        if (bi === undefined) return;
        const bt = todos.find((t) => t.id === b.blocker_id);
        if (!bt) return;
        const x1 = bt.due_date ? diffD(sod(new Date(bt.due_date)), tlStart) * dw : diffD(sod(new Date(bt.created_at)), tlStart) * dw + 8;
        const x2 = ft.start_date ? diffD(sod(new Date(ft.start_date)), tlStart) * dw : diffD(sod(new Date(ft.created_at)), tlStart) * dw;
        lines.push({ x1, y1: bi * ROW_H + ROW_H / 2 + HDR_H, x2, y2: fi * ROW_H + ROW_H / 2 + HDR_H });
      });
    });
    return lines;
  }, [deps, rowIdx, todos, tlStart, dw]);

  const [tip, setTip] = useState<{ todo: Todo; x: number; y: number } | null>(null);

  // Bar geometry helper
  const barGeo = (t: Todo) => {
    const s = t.start_date ? sod(new Date(t.start_date)) : sod(new Date(t.created_at));
    const hasDue = !!t.due_date;
    const e = hasDue ? sod(new Date(t.due_date!)) : s;
    const left = diffD(s, tlStart) * dw;
    const w = hasDue ? Math.max((diffD(e, s) + 1) * dw, 8) : 0;
    return { left, w, hasDue };
  };

  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--foreground)', background: 'var(--background)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-medium mr-4">Timeline</span>
        {(['week', 'month', 'quarter'] as ZoomLevel[]).map((lvl) => (
          <button key={lvl} onClick={() => setZoom(lvl)}
            className="px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize"
            style={{ background: zoom === lvl ? 'var(--accent)' : 'transparent', color: zoom === lvl ? '#fff' : 'var(--text-muted)', border: `1px solid ${zoom === lvl ? 'var(--accent)' : 'var(--border)'}` }}>
            {lvl}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setZoom((z) => (z === 'quarter' ? 'month' : 'week'))} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setZoom((z) => (z === 'week' ? 'month' : 'quarter'))} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left panel (hidden on mobile) */}
        <div ref={leftRef} className="hidden md:block shrink-0 overflow-y-auto overflow-x-hidden border-r" style={{ width: LEFT_W, borderColor: 'var(--border)' }} onScroll={() => handleScroll('left')}>
          <div className="sticky top-0 z-10 border-b text-xs font-semibold px-3 flex items-center" style={{ height: HDR_H, borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Tasks</div>
          {rows.map((row, i) => {
            if (row.type === 'header') {
              const g = row.group, k = row.key, nm = g.project?.name || 'No Project', c = g.project?.color || NO_COLOR;
              return (
                <div key={`lh-${k}`} className="flex items-center gap-2 px-3 cursor-pointer select-none font-medium text-sm hover:opacity-80" style={{ height: ROW_H, background: 'var(--surface-2)' }} onClick={() => toggle(k)}>
                  {g.collapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="truncate">{nm}</span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{g.todos.length}</span>
                </div>
              );
            }
            const t = row.todo;
            return (
              <div key={`lt-${t.id}`} className="flex items-center px-3 pl-8 text-sm cursor-pointer truncate hover:opacity-80"
                style={{ height: ROW_H, opacity: t.completed ? 0.5 : 1, textDecoration: t.completed ? 'line-through' : 'none', borderBottom: '1px solid var(--border)' }}
                onClick={() => onTaskClick(t)} title={t.text}>
                <span className="truncate">{t.text}</span>
              </div>
            );
          })}
        </div>

        {/* Right panel — timeline */}
        <div ref={rightRef} className="flex-1 overflow-auto relative" onScroll={() => handleScroll('right')}>
          <div style={{ width: tlW, minHeight: '100%', position: 'relative' }}>
            {/* Date headers */}
            <div className="sticky top-0 z-10 flex border-b" style={{ height: HDR_H, borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              {ticks.map((tk, i) => {
                const left = diffD(tk, tlStart) * dw;
                const w = ticks[i + 1] ? diffD(ticks[i + 1], tlStart) * dw - left : tlW - left;
                return <div key={i} className="absolute top-0 flex items-end pb-2 px-2 text-xs border-l" style={{ left, width: w, height: HDR_H, borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{fmtHdr(tk, zoom)}</div>;
              })}
            </div>
            {/* Grid lines */}
            {ticks.map((tk, i) => <div key={`gl-${i}`} className="absolute top-0 bottom-0 border-l" style={{ left: diffD(tk, tlStart) * dw, borderColor: 'var(--border)', opacity: 0.4 }} />)}
            {/* Today marker */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayX, width: 2, background: '#ef4444' }} />
            <div className="absolute z-20 text-[10px] font-bold px-1 rounded pointer-events-none" style={{ left: todayX - 16, top: HDR_H + 2, background: '#ef4444', color: '#fff' }}>Today</div>

            {/* Row backgrounds */}
            {rows.map((row, i) => {
              const top = HDR_H + i * ROW_H;
              if (row.type === 'header') return <div key={`rh-${row.key}`} className="absolute left-0 right-0 cursor-pointer" style={{ top, height: ROW_H, background: 'var(--surface-2)', opacity: 0.6 }} onClick={() => toggle(row.key)} />;
              return <div key={`rb-${row.todo.id}`} className="absolute left-0 right-0" style={{ top, height: ROW_H, borderBottom: '1px solid var(--border)', opacity: 0.15 }} />;
            })}

            {/* Task bars */}
            {rows.map((row, i) => {
              if (row.type !== 'task') return null;
              const t = row.todo, c = row.color, top = HDR_H + i * ROW_H;
              const { left, w, hasDue } = barGeo(t);
              const od = overdue(t.due_date, t.completed);
              if (!hasDue) {
                return (
                  <div key={`bar-${t.id}`} className="absolute cursor-pointer z-10"
                    style={{ left: left - 5, top: top + (ROW_H - 10) / 2, width: 10, height: 10, borderRadius: '50%', background: c, opacity: t.completed ? 0.4 : 0.9, border: '2px solid var(--background)' }}
                    onClick={() => onTaskClick(t)} onMouseEnter={(e) => setTip({ todo: t, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
                    <span className="md:hidden absolute left-4 top-[-3px] text-[10px] whitespace-nowrap font-medium" style={{ color: 'var(--foreground)' }}>{t.text.length > 25 ? t.text.slice(0, 25) + '...' : t.text}</span>
                  </div>
                );
              }
              return (
                <div key={`bar-${t.id}`} className="absolute cursor-pointer z-10 rounded-md flex items-center overflow-hidden"
                  style={{ left, top: top + (ROW_H - 24) / 2, width: w, height: 24, background: c, opacity: t.completed ? 0.4 : 0.85, boxShadow: od ? '0 0 0 2px #ef4444, 0 0 8px rgba(239,68,68,0.4)' : 'none', transition: 'opacity 0.15s' }}
                  onClick={() => onTaskClick(t)} onMouseEnter={(e) => setTip({ todo: t, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
                  <span className="md:hidden text-[10px] px-1.5 truncate font-medium" style={{ color: '#fff' }}>{t.text}</span>
                  {w > 60 && <span className="hidden md:block text-[10px] px-1.5 truncate font-medium" style={{ color: '#fff' }}>{t.text}</span>}
                </div>
              );
            })}

            {/* Dependency arrows */}
            {depLines.length > 0 && (
              <svg className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 5, overflow: 'visible' }} width={tlW} height={HDR_H + rows.length * ROW_H}>
                <defs><marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-muted)" opacity="0.6" /></marker></defs>
                {depLines.map((l, i) => <path key={`dep-${i}`} d={`M${l.x1},${l.y1} C${l.x1 + 20},${l.y1} ${l.x2 - 20},${l.y2} ${l.x2},${l.y2}`} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.5" markerEnd="url(#gantt-arrow)" />)}
              </svg>
            )}
            <div style={{ height: rows.length * ROW_H + HDR_H }} />
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tip && (
        <div className="fixed z-50 px-3 py-2 rounded-lg shadow-lg text-xs max-w-[260px] pointer-events-none"
          style={{ left: tip.x + 12, top: tip.y + 12, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
          <div className="font-semibold mb-1 truncate">{tip.todo.text}</div>
          <div style={{ color: 'var(--text-muted)' }}>
            {tip.todo.start_date && <div>Start: {new Date(tip.todo.start_date).toLocaleDateString()}</div>}
            {tip.todo.due_date ? <div>Due: {new Date(tip.todo.due_date).toLocaleDateString()}</div> : <div>No due date</div>}
            <div>Status: {tip.todo.status.replace('_', ' ')}</div>
            {tip.todo.priority && <div>Priority: {tip.todo.priority}</div>}
            {tip.todo.assigned_to && <div>Assigned: {tip.todo.assigned_to}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
