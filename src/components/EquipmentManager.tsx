'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Search,
  Settings,
  Trash2,
  Edit3,
  Download,
  ChevronDown,
  AlertTriangle,
  MapPin,
  Clock,
} from 'lucide-react';
import {
  LabEquipment,
  EquipmentBooking,
  EquipmentCategory,
  EquipmentStatus,
  BookingRules,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUS_CONFIG,
  EQUIPMENT_COLOR_PALETTE,
  DEFAULT_BOOKING_RULES,
  DEFAULT_EQUIPMENT_PRESETS,
} from '@/types/equipment';

// ─── Sub-components ───────────────────────────────────────────────

interface EquipmentFormData {
  name: string;
  description: string;
  category: EquipmentCategory;
  location: string;
  status: EquipmentStatus;
  specifications: string;
  color: string;
  booking_rules: BookingRules;
}

const EMPTY_FORM: EquipmentFormData = {
  name: '',
  description: '',
  category: 'general',
  location: '',
  status: 'available',
  specifications: '',
  color: EQUIPMENT_COLOR_PALETTE[0],
  booking_rules: { ...DEFAULT_BOOKING_RULES },
};

function EquipmentForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: EquipmentFormData;
  onSubmit: (data: EquipmentFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<EquipmentFormData>(initial);

  const update = <K extends keyof EquipmentFormData>(
    key: K,
    value: EquipmentFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateRule = <K extends keyof BookingRules>(
    key: K,
    value: BookingRules[K]
  ) =>
    setForm((prev) => ({
      ...prev,
      booking_rules: { ...prev.booking_rules, [key]: value },
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim()) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + Category Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g., Confocal Microscope"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value as EquipmentCategory)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          >
            {(Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {EQUIPMENT_CATEGORIES[cat].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Location + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="e.g., Room 204, Biology Building"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value as EquipmentStatus)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          >
            {(Object.keys(EQUIPMENT_STATUS_CONFIG) as EquipmentStatus[]).map((s) => (
              <option key={s} value={s}>
                {EQUIPMENT_STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Brief description of the equipment"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
        />
      </div>

      {/* Specifications */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Specifications
        </label>
        <textarea
          value={form.specifications}
          onChange={(e) => update('specifications', e.target.value)}
          placeholder="Technical specs, capabilities, etc."
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
        />
      </div>

      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Calendar Color
        </label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update('color', c)}
              className={`
                w-7 h-7 rounded-full border-2 transition-all
                ${form.color === c ? 'border-[var(--foreground)] scale-110' : 'border-transparent hover:scale-105'}
              `}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Booking Rules */}
      <div className="border border-[var(--border)] rounded-lg p-3 space-y-3">
        <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Booking Rules
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Max Duration (hrs)
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.booking_rules.max_duration_hours}
              onChange={(e) => updateRule('max_duration_hours', Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Min Advance (hrs)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.booking_rules.min_advance_hours}
              onChange={(e) => updateRule('min_advance_hours', Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Max Advance (days)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.booking_rules.max_advance_days}
              onChange={(e) => updateRule('max_advance_days', Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.booking_rules.requires_training}
              onChange={(e) => updateRule('requires_training', e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-sm text-[var(--foreground)]">Requires training</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.booking_rules.allow_recurring}
              onChange={(e) => updateRule('allow_recurring', e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-sm text-[var(--foreground)]">Allow recurring</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!form.name.trim() || !form.location.trim()}
          className="px-5 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────

interface EquipmentManagerProps {
  equipment: LabEquipment[];
  bookings: EquipmentBooking[];
  onAddEquipment: (eq: Omit<LabEquipment, 'id' | 'created_at'>) => LabEquipment;
  onUpdateEquipment: (id: string, updates: Partial<LabEquipment>) => void;
  onDeleteEquipment: (id: string) => void;
  onLoadPresets: () => void;
  onClose: () => void;
}

export default function EquipmentManager({
  equipment,
  bookings,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  onLoadPresets,
  onClose,
}: EquipmentManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If a delete confirmation is open, close that first
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
        } else if (editingId) {
          setEditingId(null);
        } else if (showAddForm) {
          setShowAddForm(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, confirmDeleteId, editingId, showAddForm]);

  // Filtered equipment
  const filteredEquipment = useMemo(() => {
    let list = equipment;
    if (categoryFilter !== 'all') {
      list = list.filter((eq) => eq.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (eq) =>
          eq.name.toLowerCase().includes(q) ||
          eq.location.toLowerCase().includes(q) ||
          (eq.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [equipment, categoryFilter, searchQuery]);

  // Get booking count for equipment
  const bookingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.status !== 'cancelled') {
        counts[b.equipment_id] = (counts[b.equipment_id] || 0) + 1;
      }
    });
    return counts;
  }, [bookings]);

  const handleAdd = useCallback(
    (data: EquipmentFormData) => {
      onAddEquipment({
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        category: data.category,
        location: data.location.trim(),
        status: data.status,
        specifications: data.specifications.trim() || undefined,
        color: data.color,
        booking_rules: data.booking_rules,
      });
      setShowAddForm(false);
    },
    [onAddEquipment]
  );

  const handleEdit = useCallback(
    (data: EquipmentFormData) => {
      if (!editingId) return;
      onUpdateEquipment(editingId, {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        category: data.category,
        location: data.location.trim(),
        status: data.status,
        specifications: data.specifications.trim() || undefined,
        color: data.color,
        booking_rules: data.booking_rules,
      });
      setEditingId(null);
    },
    [editingId, onUpdateEquipment]
  );

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteEquipment(id);
      setConfirmDeleteId(null);
      if (expandedId === id) setExpandedId(null);
    },
    [onDeleteEquipment, expandedId]
  );

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
        className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Manage equipment"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Manage Equipment
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Close equipment manager"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border)] flex-shrink-0 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search equipment..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EquipmentCategory | 'all')}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          >
            <option value="all">All Categories</option>
            {(Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {EQUIPMENT_CATEGORIES[cat].label}
              </option>
            ))}
          </select>

          {/* Add + Presets */}
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
          {equipment.length === 0 && (
            <button
              onClick={onLoadPresets}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Load Presets
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="p-4 border border-[var(--accent)]/30 rounded-xl bg-[var(--accent)]/5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                    Add New Equipment
                  </h3>
                  <EquipmentForm
                    initial={EMPTY_FORM}
                    onSubmit={handleAdd}
                    onCancel={() => setShowAddForm(false)}
                    submitLabel="Add Equipment"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Equipment List */}
          {filteredEquipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-50" />
              <p className="text-[var(--text-muted)] mb-2">No equipment found</p>
              {equipment.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  Add equipment or load common lab presets to get started.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEquipment.map((eq) => {
                const catInfo = EQUIPMENT_CATEGORIES[eq.category];
                const statusInfo = EQUIPMENT_STATUS_CONFIG[eq.status];
                const bookingCount = bookingCounts[eq.id] || 0;
                const isEditing = editingId === eq.id;
                const isExpanded = expandedId === eq.id;
                const isDeleting = confirmDeleteId === eq.id;

                if (isEditing) {
                  return (
                    <div
                      key={eq.id}
                      className="p-4 border border-[var(--accent)]/30 rounded-xl bg-[var(--accent)]/5"
                    >
                      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                        Edit: {eq.name}
                      </h3>
                      <EquipmentForm
                        initial={{
                          name: eq.name,
                          description: eq.description ?? '',
                          category: eq.category,
                          location: eq.location,
                          status: eq.status,
                          specifications: eq.specifications ?? '',
                          color: eq.color,
                          booking_rules: eq.booking_rules,
                        }}
                        onSubmit={handleEdit}
                        onCancel={() => setEditingId(null)}
                        submitLabel="Save Changes"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={eq.id}
                    className="border border-[var(--border)] rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Color dot */}
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: eq.color }}
                      />

                      {/* Info */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : eq.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-[var(--foreground)] truncate">
                            {eq.name}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {catInfo.label}
                          </span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: statusInfo.bgColor, color: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {eq.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditingId(eq.id); setShowAddForm(false); }}
                          className="p-1.5 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(eq.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronDown
                          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pt-1 border-t border-[var(--border)] space-y-2">
                            {eq.description && (
                              <p className="text-sm text-[var(--text-muted)]">{eq.description}</p>
                            )}
                            {eq.specifications && (
                              <div>
                                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Specs:</span>
                                <p className="text-sm text-[var(--foreground)] mt-0.5">
                                  {eq.specifications}
                                </p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                              <span>Max: {eq.booking_rules.max_duration_hours}h</span>
                              <span>Advance: {eq.booking_rules.min_advance_hours}h min, {eq.booking_rules.max_advance_days}d max</span>
                              {eq.booking_rules.requires_training && (
                                <span className="text-amber-600 dark:text-amber-400">Training required</span>
                              )}
                              {eq.booking_rules.allow_recurring && (
                                <span>Recurring allowed</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Delete Confirmation */}
                    <AnimatePresence>
                      {isDeleting && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-3 px-4 py-3 border-t border-red-500/20 bg-red-500/5">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600 dark:text-red-400 flex-1">
                              Delete &quot;{eq.name}&quot;{bookingCount > 0 ? ` and its ${bookingCount} active booking${bookingCount !== 1 ? 's' : ''}` : ''}?
                            </p>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] rounded transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(eq.id)}
                              className="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* Preset Loader (when some equipment exists but user might want more) */}
          {equipment.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <button
                onClick={onLoadPresets}
                className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <Download className="w-4 h-4" />
                Load more preset equipment ({DEFAULT_EQUIPMENT_PRESETS.length} items)
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
