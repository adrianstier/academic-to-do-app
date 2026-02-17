'use client';

import { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Check,
} from 'lucide-react';
import {
  LabEquipment,
  EquipmentCategory,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUS_CONFIG,
} from '@/types/equipment';

interface EquipmentSidebarProps {
  equipment: LabEquipment[];
  selectedCategories: Set<EquipmentCategory>;
  onToggleCategory: (cat: EquipmentCategory) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  visibleEquipmentIds: Set<string>;
  onToggleEquipment: (id: string) => void;
}

export default function EquipmentSidebar({
  equipment,
  selectedCategories,
  onToggleCategory,
  onSelectAll,
  onClearAll,
  visibleEquipmentIds,
  onToggleEquipment,
}: EquipmentSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const allCategories = useMemo(
    () => Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[],
    []
  );

  const filteredEquipment = useMemo(() => {
    let list = equipment.filter((eq) => eq.status !== 'retired');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (eq) =>
          eq.name.toLowerCase().includes(q) ||
          eq.location.toLowerCase().includes(q)
      );
    }
    return list;
  }, [equipment, searchQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<EquipmentCategory, LabEquipment[]>();
    filteredEquipment.forEach((eq) => {
      const existing = map.get(eq.category);
      if (existing) {
        existing.push(eq);
      } else {
        map.set(eq.category, [eq]);
      }
    });
    return map;
  }, [filteredEquipment]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Categories
          </h3>
          <div className="flex items-center gap-1.5 text-[10px]">
            <button
              onClick={onSelectAll}
              className="text-[var(--accent)] hover:underline"
            >
              All
            </button>
            <span className="text-[var(--text-muted)]">|</span>
            <button
              onClick={onClearAll}
              className="text-[var(--text-muted)] hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="space-y-0.5">
          {allCategories.map((cat) => {
            const catInfo = EQUIPMENT_CATEGORIES[cat];
            const isSelected = selectedCategories.has(cat);
            const count = grouped.get(cat)?.length ?? 0;
            if (count === 0 && !isSelected) return null;
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors text-xs
                  ${isSelected ? 'bg-[var(--surface-2)]' : 'opacity-50 hover:opacity-75'}
                `}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: catInfo.color }}
                />
                <span className="flex-1 text-[var(--foreground)] truncate">{catInfo.label}</span>
                <span className="text-[var(--text-muted)]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment List */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
          Equipment
        </h3>
        <div className="space-y-0.5">
          {filteredEquipment.map((eq) => {
            const statusInfo = EQUIPMENT_STATUS_CONFIG[eq.status];
            const isVisible = visibleEquipmentIds.has(eq.id);

            // Only show equipment from selected categories
            if (!selectedCategories.has(eq.category)) return null;

            return (
              <button
                key={eq.id}
                onClick={() => onToggleEquipment(eq.id)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors
                  ${isVisible ? 'bg-[var(--surface-2)]' : 'opacity-40 hover:opacity-60'}
                `}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: eq.color }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[var(--foreground)] truncate block">
                    {eq.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate block">
                    {eq.location}
                  </span>
                </div>
                {/* Status dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusInfo.color }}
                  title={statusInfo.label}
                />
              </button>
            );
          })}
          {filteredEquipment.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] italic py-2 text-center">
              No equipment found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
