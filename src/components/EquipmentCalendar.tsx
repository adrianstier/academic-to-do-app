'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Settings,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  format,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  isSameDay,
  startOfDay,
} from 'date-fns';
import {
  LabEquipment,
  EquipmentBooking,
  EquipmentCategory,
  EQUIPMENT_CATEGORIES,
} from '@/types/equipment';
import { useEquipmentData } from '@/hooks/useEquipmentData';
import EquipmentSidebar from './equipment-calendar/EquipmentSidebar';
import TimeGrid from './equipment-calendar/TimeGrid';
import EquipmentBookingForm from './EquipmentBookingForm';
import EquipmentManager from './EquipmentManager';

type CalendarViewMode = 'week' | 'day';

interface EquipmentCalendarProps {
  currentUser: string;
  teamId?: string;
}

const headerVariants = {
  enter: (direction: 'left' | 'right') => ({
    x: direction === 'right' ? 50 : -50,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'left' | 'right') => ({
    x: direction === 'right' ? -50 : 50,
    opacity: 0,
  }),
};

function getHeaderLabel(viewMode: CalendarViewMode, currentDate: Date): string {
  if (viewMode === 'day') {
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  }
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  if (sameMonth) {
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
  }
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
}

function getHeaderKey(viewMode: CalendarViewMode, currentDate: Date): string {
  if (viewMode === 'day') return format(currentDate, 'yyyy-MM-dd');
  return format(startOfWeek(currentDate), 'yyyy-ww');
}

export default function EquipmentCalendar({
  currentUser,
  teamId = 'default',
}: EquipmentCalendarProps) {
  // ── Data ──
  const {
    equipment,
    bookings,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    loadPresets,
    addBooking,
    cancelBooking,
    validateBooking,
    getEquipmentById,
  } = useEquipmentData(teamId);

  // ── UI State ──
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [showManager, setShowManager] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingFormData, setBookingFormData] = useState<{
    equipmentId?: string;
    date?: string;
    hour?: number;
  }>({});
  const [selectedBooking, setSelectedBooking] = useState<EquipmentBooking | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Category filters
  const allCategories = useMemo(
    () => Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[],
    []
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<EquipmentCategory>>(
    () => new Set(allCategories)
  );

  // Visible equipment (toggle individual equipment on/off)
  const [visibleEquipmentIds, setVisibleEquipmentIds] = useState<Set<string>>(
    () => new Set(equipment.map((eq) => eq.id))
  );

  // Sync visible equipment when equipment list changes (new items added)
  useEffect(() => {
    setVisibleEquipmentIds((prev) => {
      const next = new Set(prev);
      equipment.forEach((eq) => {
        if (!next.has(eq.id) && eq.status !== 'retired') {
          next.add(eq.id);
        }
      });
      return next;
    });
  }, [equipment]);

  // ── Navigation ──
  const goToPrevious = useCallback(() => {
    setDirection('left');
    setCurrentDate((prev) =>
      viewMode === 'week' ? subWeeks(prev, 1) : subDays(prev, 1)
    );
  }, [viewMode]);

  const goToNext = useCallback(() => {
    setDirection('right');
    setCurrentDate((prev) =>
      viewMode === 'week' ? addWeeks(prev, 1) : addDays(prev, 1)
    );
  }, [viewMode]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setDirection(startOfDay(today) > startOfDay(currentDate) ? 'right' : 'left');
    setCurrentDate(today);
  }, [currentDate]);

  // Whether current view includes today
  const viewIncludesToday = useMemo(() => {
    const today = startOfDay(new Date());
    if (viewMode === 'day') return isSameDay(currentDate, today);
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    return today >= weekStart && today <= weekEnd;
  }, [currentDate, viewMode]);

  // ── Category Filters ──
  const toggleCategory = useCallback((cat: EquipmentCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const selectAllCategories = useCallback(() => {
    setSelectedCategories(new Set(allCategories));
  }, [allCategories]);

  const clearAllCategories = useCallback(() => {
    setSelectedCategories(new Set());
  }, []);

  // ── Equipment Visibility ──
  const toggleEquipmentVisibility = useCallback((id: string) => {
    setVisibleEquipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filter visible equipment by selected categories
  const filteredVisibleIds = useMemo(() => {
    const ids = new Set<string>();
    equipment.forEach((eq) => {
      if (
        visibleEquipmentIds.has(eq.id) &&
        selectedCategories.has(eq.category) &&
        eq.status !== 'retired'
      ) {
        ids.add(eq.id);
      }
    });
    return ids;
  }, [equipment, visibleEquipmentIds, selectedCategories]);

  // ── Booking Actions ──
  const handleSlotClick = useCallback(
    (equipmentId: string, date: string, hour: number) => {
      setBookingFormData({ equipmentId, date, hour });
      setSelectedBooking(null);
      setShowBookingForm(true);
    },
    []
  );

  const handleBookingClick = useCallback((booking: EquipmentBooking) => {
    setSelectedBooking(booking);
    setBookingFormData({
      equipmentId: booking.equipment_id,
      date: booking.start_time.split('T')[0],
    });
    setShowBookingForm(true);
  }, []);

  const handleNewBooking = useCallback(() => {
    setSelectedBooking(null);
    setBookingFormData({
      date: format(currentDate, 'yyyy-MM-dd'),
    });
    setShowBookingForm(true);
  }, [currentDate]);

  // ── Keyboard Shortcuts ──
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!containerRef.current || containerRef.current.offsetParent === null) return;
      if (document.querySelector('[role="dialog"]')) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 't':
        case 'T':
          goToToday();
          break;
        case 'd':
        case 'D':
          setViewMode('day');
          break;
        case 'w':
        case 'W':
          setViewMode('week');
          break;
        case 'n':
        case 'N':
          handleNewBooking();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, goToToday, handleNewBooking]);

  // ── Navigation label ──
  const navLabel = viewMode === 'week' ? 'week' : 'day';
  const headerLabel = getHeaderLabel(viewMode, currentDate);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-[var(--surface-2)] rounded-xl border border-[var(--border)] overflow-hidden"
    >
      {/* Accessible announcement */}
      <div aria-live="polite" className="sr-only">
        {headerLabel}
      </div>

      {/* ── Header / Toolbar ── */}
      <div
        role="navigation"
        aria-label="Equipment calendar navigation"
        className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Previous */}
          <button
            onClick={goToPrevious}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            aria-label={`Previous ${navLabel}`}
          >
            <ChevronLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </button>

          {/* Date Display */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.h2
              key={getHeaderKey(viewMode, currentDate)}
              custom={direction}
              variants={headerVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="text-base sm:text-lg font-semibold text-[var(--foreground)] min-w-[140px] text-center"
            >
              {headerLabel}
            </motion.h2>
          </AnimatePresence>

          {/* Next */}
          <button
            onClick={goToNext}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            aria-label={`Next ${navLabel}`}
          >
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
          </button>

          {/* Today */}
          <button
            onClick={goToToday}
            aria-label="Go to today"
            className={`
              flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors
              ${!viewIncludesToday ? 'animate-pulse ring-2 ring-[var(--accent)]/50' : ''}
            `}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Today</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'day'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Day
            </button>
          </div>

          {/* Sidebar Toggle (mobile) */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors lg:hidden"
            aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showSidebar ? (
              <EyeOff className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <Eye className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>

          {/* New Booking */}
          <button
            onClick={handleNewBooking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Book</span>
          </button>

          {/* Manage Equipment */}
          <button
            onClick={() => setShowManager(true)}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--foreground)]"
            aria-label="Manage equipment"
            title="Manage equipment"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`
            border-r border-[var(--border)] bg-[var(--surface)] flex-shrink-0 transition-all
            ${showSidebar
              ? 'w-[220px] lg:w-[240px]'
              : 'w-0 overflow-hidden'
            }
            max-lg:absolute max-lg:left-0 max-lg:top-[57px] max-lg:bottom-0 max-lg:z-20 max-lg:shadow-lg
            ${!showSidebar ? 'max-lg:hidden' : ''}
          `}
        >
          <EquipmentSidebar
            equipment={equipment}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            onSelectAll={selectAllCategories}
            onClearAll={clearAllCategories}
            visibleEquipmentIds={visibleEquipmentIds}
            onToggleEquipment={toggleEquipmentVisibility}
          />
        </div>

        {/* Main Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {equipment.length === 0 ? (
            // Empty state
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Settings className="w-16 h-16 text-[var(--text-muted)] mb-4 opacity-40" />
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                No Equipment Yet
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-6 max-w-md">
                Add your lab equipment to start scheduling. You can load common presets
                for microscopes, centrifuges, sequencers, and more.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowManager(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Equipment
                </button>
                <button
                  onClick={loadPresets}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg border border-[var(--accent)]/30 transition-colors"
                >
                  Load Lab Presets
                </button>
              </div>
            </div>
          ) : (
            <TimeGrid
              viewMode={viewMode}
              currentDate={currentDate}
              equipment={equipment}
              bookings={bookings}
              visibleEquipmentIds={filteredVisibleIds}
              onSlotClick={handleSlotClick}
              onBookingClick={handleBookingClick}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showBookingForm && (
          <EquipmentBookingForm
            equipment={equipment}
            bookings={bookings}
            onSubmit={addBooking}
            onClose={() => {
              setShowBookingForm(false);
              setSelectedBooking(null);
            }}
            validateBooking={validateBooking}
            currentUser={currentUser}
            preselectedEquipmentId={bookingFormData.equipmentId}
            preselectedDate={bookingFormData.date}
            preselectedHour={bookingFormData.hour}
            editingBooking={selectedBooking}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManager && (
          <EquipmentManager
            equipment={equipment}
            bookings={bookings}
            onAddEquipment={addEquipment}
            onUpdateEquipment={updateEquipment}
            onDeleteEquipment={deleteEquipment}
            onLoadPresets={loadPresets}
            onClose={() => setShowManager(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
