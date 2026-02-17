/**
 * useEquipmentData Hook
 *
 * Manages lab equipment and booking data using localStorage.
 * Provides CRUD operations for equipment inventory and bookings
 * with conflict detection and validation.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LabEquipment,
  EquipmentBooking,
  BookingRules,
  DEFAULT_EQUIPMENT_PRESETS,
  DEFAULT_BOOKING_RULES,
  EquipmentCategory,
} from '@/types/equipment';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getStorageKey(teamId: string, type: 'equipment' | 'bookings'): string {
  return type === 'equipment'
    ? `labEquipment:${teamId}`
    : `equipmentBookings:${teamId}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export interface UseEquipmentDataReturn {
  // Equipment
  equipment: LabEquipment[];
  addEquipment: (eq: Omit<LabEquipment, 'id' | 'created_at'>) => LabEquipment;
  updateEquipment: (id: string, updates: Partial<LabEquipment>) => void;
  deleteEquipment: (id: string) => void;
  loadPresets: () => void;

  // Bookings
  bookings: EquipmentBooking[];
  addBooking: (booking: Omit<EquipmentBooking, 'id' | 'created_at'>) => EquipmentBooking | null;
  updateBooking: (id: string, updates: Partial<EquipmentBooking>) => void;
  cancelBooking: (id: string) => void;
  deleteBooking: (id: string) => void;

  // Queries
  getBookingsForEquipment: (equipmentId: string) => EquipmentBooking[];
  getBookingsForDate: (date: string) => EquipmentBooking[];
  getBookingsForDateRange: (startDate: string, endDate: string) => EquipmentBooking[];
  checkConflict: (
    equipmentId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ) => EquipmentBooking | null;
  validateBooking: (
    equipmentId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ) => { valid: boolean; error?: string };
  getEquipmentById: (id: string) => LabEquipment | undefined;
  getEquipmentByCategory: (category: EquipmentCategory) => LabEquipment[];
}

export function useEquipmentData(teamId: string): UseEquipmentDataReturn {
  const equipmentKey = getStorageKey(teamId, 'equipment');
  const bookingsKey = getStorageKey(teamId, 'bookings');

  const [equipment, setEquipment] = useState<LabEquipment[]>(() =>
    loadFromStorage<LabEquipment[]>(equipmentKey, [])
  );

  const [bookings, setBookings] = useState<EquipmentBooking[]>(() =>
    loadFromStorage<EquipmentBooking[]>(bookingsKey, [])
  );

  // Persist equipment changes
  useEffect(() => {
    saveToStorage(equipmentKey, equipment);
  }, [equipment, equipmentKey]);

  // Persist booking changes
  useEffect(() => {
    saveToStorage(bookingsKey, bookings);
  }, [bookings, bookingsKey]);

  // ── Equipment CRUD ──────────────────────────────────────────────

  const addEquipment = useCallback(
    (eq: Omit<LabEquipment, 'id' | 'created_at'>): LabEquipment => {
      const newEquipment: LabEquipment = {
        ...eq,
        id: generateId(),
        created_at: new Date().toISOString(),
      };
      setEquipment((prev) => [...prev, newEquipment]);
      return newEquipment;
    },
    []
  );

  const updateEquipment = useCallback((id: string, updates: Partial<LabEquipment>) => {
    setEquipment((prev) =>
      prev.map((eq) => (eq.id === id ? { ...eq, ...updates } : eq))
    );
  }, []);

  const deleteEquipment = useCallback(
    (id: string) => {
      setEquipment((prev) => prev.filter((eq) => eq.id !== id));
      // Also remove all bookings for this equipment
      setBookings((prev) => prev.filter((b) => b.equipment_id !== id));
    },
    []
  );

  const loadPresets = useCallback(() => {
    const presets = DEFAULT_EQUIPMENT_PRESETS.map((preset) => ({
      ...preset,
      id: generateId(),
      created_at: new Date().toISOString(),
    }));
    setEquipment((prev) => [...prev, ...presets]);
  }, []);

  // ── Booking Queries ─────────────────────────────────────────────

  const getBookingsForEquipment = useCallback(
    (equipmentId: string): EquipmentBooking[] => {
      return bookings.filter(
        (b) => b.equipment_id === equipmentId && b.status !== 'cancelled'
      );
    },
    [bookings]
  );

  const getBookingsForDate = useCallback(
    (date: string): EquipmentBooking[] => {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      return bookings.filter(
        (b) =>
          b.status !== 'cancelled' &&
          b.start_time < dayEnd &&
          b.end_time > dayStart
      );
    },
    [bookings]
  );

  const getBookingsForDateRange = useCallback(
    (startDate: string, endDate: string): EquipmentBooking[] => {
      const rangeStart = `${startDate}T00:00:00`;
      const rangeEnd = `${endDate}T23:59:59`;
      return bookings.filter(
        (b) =>
          b.status !== 'cancelled' &&
          b.start_time < rangeEnd &&
          b.end_time > rangeStart
      );
    },
    [bookings]
  );

  const checkConflict = useCallback(
    (
      equipmentId: string,
      startTime: string,
      endTime: string,
      excludeBookingId?: string
    ): EquipmentBooking | null => {
      return (
        bookings.find(
          (b) =>
            b.equipment_id === equipmentId &&
            b.status !== 'cancelled' &&
            b.id !== excludeBookingId &&
            b.start_time < endTime &&
            b.end_time > startTime
        ) ?? null
      );
    },
    [bookings]
  );

  const validateBooking = useCallback(
    (
      equipmentId: string,
      startTime: string,
      endTime: string,
      excludeBookingId?: string
    ): { valid: boolean; error?: string } => {
      const eq = equipment.find((e) => e.id === equipmentId);
      if (!eq) return { valid: false, error: 'Equipment not found' };

      if (eq.status === 'maintenance')
        return { valid: false, error: 'Equipment is under maintenance' };
      if (eq.status === 'retired')
        return { valid: false, error: 'Equipment has been retired' };

      const start = new Date(startTime);
      const end = new Date(endTime);
      const now = new Date();

      if (start >= end)
        return { valid: false, error: 'End time must be after start time' };

      const rules: BookingRules = eq.booking_rules || DEFAULT_BOOKING_RULES;

      // Check duration
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (durationHours > rules.max_duration_hours) {
        return {
          valid: false,
          error: `Maximum booking duration is ${rules.max_duration_hours} hours`,
        };
      }

      // Check minimum advance time
      const advanceHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (advanceHours < rules.min_advance_hours) {
        return {
          valid: false,
          error: `Bookings must be made at least ${rules.min_advance_hours} hours in advance`,
        };
      }

      // Check maximum advance time
      const advanceDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (advanceDays > rules.max_advance_days) {
        return {
          valid: false,
          error: `Bookings cannot be made more than ${rules.max_advance_days} days in advance`,
        };
      }

      // Check conflicts
      const conflict = checkConflict(equipmentId, startTime, endTime, excludeBookingId);
      if (conflict) {
        return {
          valid: false,
          error: `Conflicts with existing booking: "${conflict.title}" (${conflict.user_name})`,
        };
      }

      return { valid: true };
    },
    [equipment, checkConflict]
  );

  // ── Booking CRUD ────────────────────────────────────────────────

  const addBooking = useCallback(
    (
      booking: Omit<EquipmentBooking, 'id' | 'created_at'>
    ): EquipmentBooking | null => {
      const validation = validateBooking(
        booking.equipment_id,
        booking.start_time,
        booking.end_time
      );
      if (!validation.valid) return null;

      const newBooking: EquipmentBooking = {
        ...booking,
        id: generateId(),
        created_at: new Date().toISOString(),
      };
      setBookings((prev) => [...prev, newBooking]);
      return newBooking;
    },
    [validateBooking]
  );

  const updateBooking = useCallback(
    (id: string, updates: Partial<EquipmentBooking>) => {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    []
  );

  const cancelBooking = useCallback((id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: 'cancelled' as const } : b
      )
    );
  }, []);

  const deleteBooking = useCallback((id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── Lookups ─────────────────────────────────────────────────────

  const getEquipmentById = useCallback(
    (id: string): LabEquipment | undefined => {
      return equipment.find((eq) => eq.id === id);
    },
    [equipment]
  );

  const getEquipmentByCategory = useCallback(
    (category: EquipmentCategory): LabEquipment[] => {
      return equipment.filter((eq) => eq.category === category);
    },
    [equipment]
  );

  return {
    equipment,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    loadPresets,
    bookings,
    addBooking,
    updateBooking,
    cancelBooking,
    deleteBooking,
    getBookingsForEquipment,
    getBookingsForDate,
    getBookingsForDateRange,
    checkConflict,
    validateBooking,
    getEquipmentById,
    getEquipmentByCategory,
  };
}
