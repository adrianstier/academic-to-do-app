'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Calendar,
  AlertCircle,
  Repeat,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import {
  LabEquipment,
  EquipmentBooking,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUS_CONFIG,
  TIME_SLOT_MINUTES,
} from '@/types/equipment';

interface EquipmentBookingFormProps {
  equipment: LabEquipment[];
  bookings: EquipmentBooking[];
  onSubmit: (booking: Omit<EquipmentBooking, 'id' | 'created_at'>) => EquipmentBooking | null;
  onClose: () => void;
  validateBooking: (
    equipmentId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ) => { valid: boolean; error?: string };
  currentUser: string;
  preselectedEquipmentId?: string;
  preselectedDate?: string;     // YYYY-MM-DD
  preselectedHour?: number;     // 0-23
  editingBooking?: EquipmentBooking | null;
}

/** Generate time options in 30-min increments for a dropdown */
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += TIME_SLOT_MINUTES) {
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      const value = `${hh}:${mm}`;
      const ampm = h < 12 ? 'AM' : 'PM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayHour}:${mm} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function EquipmentBookingForm({
  equipment,
  bookings,
  onSubmit,
  onClose,
  validateBooking,
  currentUser,
  preselectedEquipmentId,
  preselectedDate,
  preselectedHour,
  editingBooking,
}: EquipmentBookingFormProps) {
  // Form state
  const [equipmentId, setEquipmentId] = useState(
    editingBooking?.equipment_id ?? preselectedEquipmentId ?? ''
  );
  const [title, setTitle] = useState(editingBooking?.title ?? '');
  const [date, setDate] = useState(() => {
    if (editingBooking) return editingBooking.start_time.split('T')[0];
    if (preselectedDate) return preselectedDate;
    return new Date().toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState(() => {
    if (editingBooking) {
      const t = new Date(editingBooking.start_time);
      return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
    }
    if (preselectedHour !== undefined) {
      return `${preselectedHour.toString().padStart(2, '0')}:00`;
    }
    return '09:00';
  });
  const [endTime, setEndTime] = useState(() => {
    if (editingBooking) {
      const t = new Date(editingBooking.end_time);
      return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
    }
    if (preselectedHour !== undefined) {
      const endHour = Math.min(preselectedHour + 1, 23);
      return `${endHour.toString().padStart(2, '0')}:${preselectedHour >= 23 ? '30' : '00'}`;
    }
    return '10:00';
  });
  const [notes, setNotes] = useState(editingBooking?.notes ?? '');
  const [isRecurring, setIsRecurring] = useState(!!editingBooking?.recurring);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly'>(
    editingBooking?.recurring?.frequency ?? 'weekly'
  );
  const [recurringUntil, setRecurringUntil] = useState(
    editingBooking?.recurring?.until ?? ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Selected equipment data
  const selectedEquipment = useMemo(
    () => equipment.find((e) => e.id === equipmentId),
    [equipment, equipmentId]
  );

  // Available equipment (not retired)
  const availableEquipment = useMemo(
    () => equipment.filter((e) => e.status !== 'retired'),
    [equipment]
  );

  // Live validation
  const validation = useMemo(() => {
    if (!equipmentId || !date || !startTime || !endTime) {
      return { valid: false, error: undefined };
    }
    // Catch same start/end time (zero-duration booking)
    if (startTime === endTime) {
      return { valid: false, error: 'Start and end times cannot be the same.' };
    }
    // Catch end time before start time
    if (endTime < startTime) {
      return { valid: false, error: 'End time must be after start time.' };
    }
    const startISO = `${date}T${startTime}:00`;
    const endISO = `${date}T${endTime}:00`;
    return validateBooking(
      equipmentId,
      startISO,
      endISO,
      editingBooking?.id
    );
  }, [equipmentId, date, startTime, endTime, validateBooking, editingBooking]);

  // Duration display
  const durationLabel = useMemo(() => {
    if (!startTime || !endTime) return '';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes <= 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  }, [startTime, endTime]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!equipmentId || !title.trim() || !date || !startTime || !endTime) {
        setSubmitError('Please fill in all required fields');
        return;
      }

      if (startTime === endTime) {
        setSubmitError('Start and end times cannot be the same.');
        return;
      }

      if (endTime < startTime) {
        setSubmitError('End time must be after start time.');
        return;
      }

      if (isRecurring && !recurringUntil) {
        setSubmitError('Please set an end date for the recurring booking.');
        return;
      }

      const startISO = `${date}T${startTime}:00`;
      const endISO = `${date}T${endTime}:00`;

      // Validate
      const check = validateBooking(
        equipmentId,
        startISO,
        endISO,
        editingBooking?.id
      );
      if (!check.valid) {
        setSubmitError(check.error ?? 'Invalid booking');
        return;
      }

      setSubmitting(true);

      const bookingData: Omit<EquipmentBooking, 'id' | 'created_at'> = {
        equipment_id: equipmentId,
        user_name: currentUser,
        title: title.trim(),
        start_time: startISO,
        end_time: endISO,
        notes: notes.trim() || undefined,
        status: 'confirmed',
        recurring: isRecurring && recurringUntil
          ? { frequency: recurringFrequency, until: recurringUntil }
          : undefined,
      };

      const result = onSubmit(bookingData);
      setSubmitting(false);

      if (result) {
        onClose();
      } else {
        setSubmitError('Could not create booking. There may be a conflict.');
      }
    },
    [
      equipmentId, title, date, startTime, endTime, notes,
      isRecurring, recurringFrequency, recurringUntil,
      currentUser, validateBooking, editingBooking, onSubmit, onClose,
    ]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showEquipmentDropdown) return;
    const handler = () => setShowEquipmentDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showEquipmentDropdown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={editingBooking ? 'Edit booking' : 'Book equipment'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {editingBooking ? 'Edit Booking' : 'Book Equipment'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Close booking form"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Equipment Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Equipment <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEquipmentDropdown(!showEquipmentDropdown);
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left text-sm transition-colors
                  ${equipmentId
                    ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)]'
                    : 'border-dashed border-[var(--border)] text-[var(--text-muted)]'
                  }
                  hover:border-[var(--accent)]/50
                `}
              >
                {selectedEquipment ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedEquipment.color }}
                    />
                    <span>{selectedEquipment.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      ({selectedEquipment.location})
                    </span>
                  </span>
                ) : (
                  <span>Select equipment...</span>
                )}
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </button>

              <AnimatePresence>
                {showEquipmentDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-10 w-full mt-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {availableEquipment.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">
                        No equipment available. Add equipment first.
                      </div>
                    ) : (
                      availableEquipment.map((eq) => {
                        const catInfo = EQUIPMENT_CATEGORIES[eq.category];
                        const statusInfo = EQUIPMENT_STATUS_CONFIG[eq.status];
                        return (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEquipmentId(eq.id);
                              setShowEquipmentDropdown(false);
                            }}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors
                              ${eq.id === equipmentId ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--surface-hover)]'}
                            `}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: eq.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-[var(--foreground)] truncate">
                                {eq.name}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">
                                {catInfo.label} &middot; {eq.location}
                              </div>
                            </div>
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: statusInfo.bgColor, color: statusInfo.color }}
                            >
                              {statusInfo.label}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Booking rules hint */}
            {selectedEquipment && (
              <div className="mt-2 p-2 rounded-lg bg-[var(--surface-2)] text-xs text-[var(--text-muted)] space-y-0.5">
                <p>Max duration: {selectedEquipment.booking_rules.max_duration_hours}h</p>
                {selectedEquipment.booking_rules.requires_training && (
                  <p className="text-amber-600 dark:text-amber-400">Requires training certification</p>
                )}
              </div>
            )}
          </div>

          {/* Title / Purpose */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Purpose / Experiment <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Coral fluorescence imaging - Exp 42"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              autoFocus
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              <Calendar className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={editingBooking ? undefined : new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                <Clock className="w-4 h-4 inline-block mr-1 -mt-0.5" />
                Start Time
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                End Time
                {durationLabel && (
                  <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">
                    ({durationLabel})
                  </span>
                )}
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sample prep details, special requirements, etc."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
            />
          </div>

          {/* Recurring Toggle */}
          {selectedEquipment?.booking_rules.allow_recurring && (
            <div className="border border-[var(--border)] rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <Repeat className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Recurring booking
                </span>
              </label>

              {isRecurring && (
                <div className="flex items-center gap-3 pl-6">
                  <select
                    value={recurringFrequency}
                    onChange={(e) =>
                      setRecurringFrequency(e.target.value as 'daily' | 'weekly')
                    }
                    className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <span className="text-sm text-[var(--text-muted)]">until</span>
                  <input
                    type="date"
                    value={recurringUntil}
                    onChange={(e) => setRecurringUntil(e.target.value)}
                    min={date}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </div>
              )}
            </div>
          )}

          {/* Validation Error */}
          {(submitError || (validation.error && equipmentId && startTime && endTime)) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {submitError || validation.error}
              </p>
            </div>
          )}

          {/* Validation Success */}
          {validation.valid && equipmentId && title.trim() && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-600 dark:text-green-400">
                Time slot is available
              </p>
            </div>
          )}

          {/* Footer - inside form so Enter key triggers submit */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 -mx-6 -mb-6 mt-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !validation.valid || !title.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting
                ? 'Booking...'
                : editingBooking
                  ? 'Update Booking'
                  : 'Book Equipment'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
