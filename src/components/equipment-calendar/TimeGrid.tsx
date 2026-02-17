'use client';

import { useMemo } from 'react';
import { format, addDays, startOfWeek, isToday, isSameDay } from 'date-fns';
import {
  LabEquipment,
  EquipmentBooking,
  EQUIPMENT_STATUS_CONFIG,
  DEFAULT_CALENDAR_HOURS,
  TIME_SLOT_MINUTES,
} from '@/types/equipment';

type CalendarViewMode = 'week' | 'day';

interface TimeGridProps {
  viewMode: CalendarViewMode;
  currentDate: Date;
  equipment: LabEquipment[];
  bookings: EquipmentBooking[];
  visibleEquipmentIds: Set<string>;
  onSlotClick: (equipmentId: string, date: string, hour: number) => void;
  onBookingClick: (booking: EquipmentBooking) => void;
  currentUser: string;
}

/** Format hour as 12h string */
function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/** Get booking position within the time grid for a given day */
function getBookingPosition(
  booking: EquipmentBooking,
  dayDate: string,
  startHour: number,
  endHour: number
): { top: number; height: number } | null {
  const dayStart = new Date(`${dayDate}T${startHour.toString().padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${dayDate}T${endHour.toString().padStart(2, '0')}:00:00`);

  const bStart = new Date(booking.start_time);
  const bEnd = new Date(booking.end_time);

  // Clamp to day boundaries
  const visibleStart = bStart < dayStart ? dayStart : bStart;
  const visibleEnd = bEnd > dayEnd ? dayEnd : bEnd;

  if (visibleStart >= visibleEnd) return null;

  const totalMinutes = (endHour - startHour) * 60;
  const topMinutes = (visibleStart.getTime() - dayStart.getTime()) / (1000 * 60);
  const heightMinutes = (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60);

  return {
    top: (topMinutes / totalMinutes) * 100,
    height: (heightMinutes / totalMinutes) * 100,
  };
}

/** Format time from ISO string */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
}

export default function TimeGrid({
  viewMode,
  currentDate,
  equipment,
  bookings,
  visibleEquipmentIds,
  onSlotClick,
  onBookingClick,
  currentUser,
}: TimeGridProps) {
  const { start: startHour, end: endHour } = DEFAULT_CALENDAR_HOURS;
  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = startHour; i < endHour; i++) h.push(i);
    return h;
  }, [startHour, endHour]);

  // Visible equipment filtered
  const visibleEquipment = useMemo(
    () => equipment.filter((eq) => visibleEquipmentIds.has(eq.id) && eq.status !== 'retired'),
    [equipment, visibleEquipmentIds]
  );

  // Days to display
  const days = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    }
    // Week view: 7 days
    const weekStart = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, currentDate]);

  // Active bookings indexed by equipment ID and date
  const bookingsByEqAndDay = useMemo(() => {
    const map = new Map<string, EquipmentBooking[]>();
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
    activeBookings.forEach((b) => {
      days.forEach((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayStart = `${dayStr}T00:00:00`;
        const dayEnd = `${dayStr}T23:59:59`;
        if (b.start_time < dayEnd && b.end_time > dayStart) {
          const key = `${b.equipment_id}:${dayStr}`;
          const existing = map.get(key);
          if (existing) {
            existing.push(b);
          } else {
            map.set(key, [b]);
          }
        }
      });
    });
    return map;
  }, [bookings, days]);

  if (visibleEquipment.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-[var(--text-muted)] text-sm">
          No equipment to display. Add equipment or adjust filters.
        </p>
      </div>
    );
  }

  // ─── Week View (rows = equipment, columns = days) ───

  if (viewMode === 'week') {
    return (
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Header Row: Day columns */}
          <div className="flex border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--surface)]">
            {/* Equipment column header */}
            <div className="w-[160px] flex-shrink-0 px-3 py-2 border-r border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase">
              Equipment
            </div>
            {/* Day headers */}
            {days.map((day) => {
              const today = isToday(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={format(day, 'yyyy-MM-dd')}
                  className={`
                    flex-1 min-w-[100px] px-2 py-2 text-center border-r border-[var(--border)] last:border-r-0
                    ${today
                      ? 'bg-[var(--accent)]/10'
                      : isWeekend
                        ? 'bg-[var(--surface)]/50 opacity-75'
                        : ''
                    }
                  `}
                >
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block">
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      today ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Equipment Rows */}
          {visibleEquipment.map((eq) => {
            const statusInfo = EQUIPMENT_STATUS_CONFIG[eq.status];
            return (
              <div
                key={eq.id}
                className="flex border-b border-[var(--border)] hover:bg-[var(--surface-hover)]/30 transition-colors"
              >
                {/* Equipment name cell */}
                <div className="w-[160px] flex-shrink-0 px-3 py-2 border-r border-[var(--border)] flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: eq.color }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-[var(--foreground)] truncate block">
                      {eq.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: statusInfo.color }}
                      />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Day cells */}
                {days.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const key = `${eq.id}:${dayStr}`;
                  const dayBookings = bookingsByEqAndDay.get(key) || [];
                  const today = isToday(day);

                  return (
                    <div
                      key={dayStr}
                      className={`
                        flex-1 min-w-[100px] min-h-[56px] px-1 py-1 border-r border-[var(--border)] last:border-r-0 relative cursor-pointer
                        ${today ? 'bg-[var(--accent)]/5' : ''}
                        hover:bg-[var(--accent)]/10 transition-colors
                      `}
                      onClick={() => {
                        if (eq.status === 'available' || eq.status === 'in_use') {
                          onSlotClick(eq.id, dayStr, 9);
                        }
                      }}
                    >
                      {dayBookings.map((booking) => {
                        const isOwn = booking.user_name === currentUser;
                        return (
                          <button
                            key={booking.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingClick(booking);
                            }}
                            className={`
                              w-full mb-0.5 px-1.5 py-1 rounded text-left transition-colors
                              ${isOwn
                                ? 'ring-1 ring-[var(--accent)]/40'
                                : ''
                              }
                            `}
                            style={{
                              backgroundColor: eq.color + '20',
                              borderLeft: `3px solid ${eq.color}`,
                            }}
                            title={`${booking.title} - ${booking.user_name}\n${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`}
                          >
                            <span className="text-[10px] font-medium text-[var(--foreground)] line-clamp-1 block">
                              {booking.title}
                            </span>
                            <span className="text-[9px] text-[var(--text-muted)] block">
                              {booking.user_name} &middot; {formatTime(booking.start_time)}-{formatTime(booking.end_time)}
                            </span>
                          </button>
                        );
                      })}
                      {dayBookings.length === 0 && (eq.status === 'available' || eq.status === 'in_use') && (
                        <span className="text-[10px] text-[var(--text-muted)] opacity-0 hover:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity">
                          + Book
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Day View (rows = equipment, columns = hours) ───

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[800px]">
        {/* Header Row: Hour columns */}
        <div className="flex border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--surface)]">
          <div className="w-[160px] flex-shrink-0 px-3 py-2 border-r border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase">
            Equipment
          </div>
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex-1 min-w-[60px] px-1 py-2 text-center border-r border-[var(--border)] last:border-r-0 text-[10px] font-semibold text-[var(--text-muted)]"
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Equipment Rows */}
        {visibleEquipment.map((eq) => {
          const statusInfo = EQUIPMENT_STATUS_CONFIG[eq.status];
          const dayStr = format(currentDate, 'yyyy-MM-dd');
          const key = `${eq.id}:${dayStr}`;
          const dayBookings = bookingsByEqAndDay.get(key) || [];

          return (
            <div
              key={eq.id}
              className="flex border-b border-[var(--border)] group"
            >
              {/* Equipment name */}
              <div className="w-[160px] flex-shrink-0 px-3 py-2 border-r border-[var(--border)] flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: eq.color }}
                />
                <div className="min-w-0">
                  <span className="text-xs font-medium text-[var(--foreground)] truncate block">
                    {eq.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: statusInfo.color }}
                    />
                    {statusInfo.label}
                  </span>
                </div>
              </div>

              {/* Time cells - relative container for positioning bookings */}
              <div className="flex-1 relative min-h-[52px]">
                {/* Hour grid lines */}
                <div className="flex h-full">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 min-w-[60px] border-r border-[var(--border)] last:border-r-0 cursor-pointer hover:bg-[var(--accent)]/10 transition-colors"
                      onClick={() => {
                        if (eq.status === 'available' || eq.status === 'in_use') {
                          onSlotClick(eq.id, dayStr, hour);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Booking blocks (absolute positioned) */}
                {dayBookings.map((booking) => {
                  const pos = getBookingPosition(booking, dayStr, startHour, endHour);
                  if (!pos) return null;
                  const isOwn = booking.user_name === currentUser;

                  return (
                    <button
                      key={booking.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                      className={`
                        absolute top-0.5 bottom-0.5 rounded px-1.5 py-0.5 text-left overflow-hidden transition-all
                        hover:ring-2 hover:ring-[var(--accent)]/50 hover:z-10
                        ${isOwn ? 'ring-1 ring-[var(--accent)]/40' : ''}
                      `}
                      style={{
                        left: `${pos.top}%`,
                        width: `${pos.height}%`,
                        backgroundColor: eq.color + '25',
                        borderLeft: `3px solid ${eq.color}`,
                      }}
                      title={`${booking.title}\n${booking.user_name}\n${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}${booking.notes ? '\n' + booking.notes : ''}`}
                    >
                      <span className="text-[10px] font-medium text-[var(--foreground)] line-clamp-1 block">
                        {booking.title}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)] line-clamp-1 block">
                        {booking.user_name}
                      </span>
                    </button>
                  );
                })}

                {/* Current time indicator */}
                {isToday(currentDate) && (() => {
                  const now = new Date();
                  const nowMinutes = now.getHours() * 60 + now.getMinutes();
                  const gridStart = startHour * 60;
                  const gridEnd = endHour * 60;
                  if (nowMinutes < gridStart || nowMinutes > gridEnd) return null;
                  const pct = ((nowMinutes - gridStart) / (gridEnd - gridStart)) * 100;
                  return (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                      style={{ left: `${pct}%`, backgroundColor: 'var(--danger)' }}
                    >
                      <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
