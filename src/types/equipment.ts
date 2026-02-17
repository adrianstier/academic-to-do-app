/**
 * Lab Equipment Booking Types
 *
 * Types for the equipment calendar/booking system.
 * Allows research teams to schedule shared lab equipment
 * (microscopes, centrifuges, sequencers, field gear, etc.).
 */

export interface LabEquipment {
  id: string;
  name: string;
  description?: string;
  category: EquipmentCategory;
  location: string;
  status: EquipmentStatus;
  image_url?: string;
  specifications?: string;
  booking_rules: BookingRules;
  color: string;
  created_at: string;
}

export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';

export type EquipmentCategory =
  | 'microscopy'
  | 'spectroscopy'
  | 'centrifuge'
  | 'sequencing'
  | 'imaging'
  | 'field_gear'
  | 'computing'
  | 'general'
  | 'other';

export interface BookingRules {
  max_duration_hours: number;
  min_advance_hours: number;
  max_advance_days: number;
  requires_training: boolean;
  allow_recurring: boolean;
}

export interface EquipmentBooking {
  id: string;
  equipment_id: string;
  user_name: string;
  title: string;
  start_time: string; // ISO datetime
  end_time: string;   // ISO datetime
  notes?: string;
  status: BookingStatus;
  recurring?: RecurringConfig;
  created_at: string;
}

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';

export interface RecurringConfig {
  frequency: 'daily' | 'weekly';
  until: string; // ISO date
}

export const EQUIPMENT_CATEGORIES: Record<
  EquipmentCategory,
  { label: string; icon: string; color: string }
> = {
  microscopy: { label: 'Microscopy', icon: 'Microscope', color: '#3B82F6' },
  spectroscopy: { label: 'Spectroscopy', icon: 'Rainbow', color: '#8B5CF6' },
  centrifuge: { label: 'Centrifuge', icon: 'RotateCw', color: '#10B981' },
  sequencing: { label: 'Sequencing', icon: 'Dna', color: '#EC4899' },
  imaging: { label: 'Imaging', icon: 'Camera', color: '#F59E0B' },
  field_gear: { label: 'Field Gear', icon: 'Mountain', color: '#06B6D4' },
  computing: { label: 'Computing', icon: 'Monitor', color: '#6366F1' },
  general: { label: 'General Lab', icon: 'FlaskConical', color: '#64748B' },
  other: { label: 'Other', icon: 'Package', color: '#94A3B8' },
};

export const EQUIPMENT_STATUS_CONFIG: Record<
  EquipmentStatus,
  { label: string; color: string; bgColor: string }
> = {
  available: { label: 'Available', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  in_use: { label: 'In Use', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  maintenance: { label: 'Maintenance', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
  retired: { label: 'Retired', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  max_duration_hours: 8,
  min_advance_hours: 1,
  max_advance_days: 30,
  requires_training: false,
  allow_recurring: true,
};

export const DEFAULT_EQUIPMENT_PRESETS: Omit<LabEquipment, 'id' | 'created_at'>[] = [
  {
    name: 'Confocal Microscope',
    description: 'Zeiss LSM 880 confocal laser scanning microscope for fluorescence imaging',
    category: 'microscopy',
    location: 'Room 204, Biology Building',
    status: 'available',
    specifications: 'Laser lines: 405, 488, 561, 633nm. Objectives: 10x, 20x, 40x oil, 63x oil',
    booking_rules: {
      max_duration_hours: 4,
      min_advance_hours: 24,
      max_advance_days: 14,
      requires_training: true,
      allow_recurring: true,
    },
    color: '#3B82F6',
  },
  {
    name: 'Ultracentrifuge',
    description: 'Beckman Coulter Optima XPN-100 for high-speed sample separation',
    category: 'centrifuge',
    location: 'Room 112, Chemistry Building',
    status: 'available',
    specifications: 'Max speed: 100,000 rpm. Rotors: SW 32 Ti, Type 70 Ti, SW 41 Ti',
    booking_rules: {
      max_duration_hours: 6,
      min_advance_hours: 2,
      max_advance_days: 14,
      requires_training: true,
      allow_recurring: false,
    },
    color: '#10B981',
  },
  {
    name: 'DNA Sequencer',
    description: 'Illumina MiSeq for next-generation sequencing runs',
    category: 'sequencing',
    location: 'Room 305, Genomics Core',
    status: 'available',
    specifications: 'Read length: up to 2x300bp. Output: up to 15 Gb per run',
    booking_rules: {
      max_duration_hours: 12,
      min_advance_hours: 48,
      max_advance_days: 30,
      requires_training: true,
      allow_recurring: false,
    },
    color: '#EC4899',
  },
  {
    name: 'Spectrophotometer',
    description: 'NanoDrop One UV-Vis spectrophotometer for nucleic acid quantification',
    category: 'spectroscopy',
    location: 'Room 118, Biology Building',
    status: 'available',
    specifications: 'Range: 190-850nm. Sample volume: 1-2 uL. Pathlengths: 1mm, 0.05mm',
    booking_rules: {
      max_duration_hours: 2,
      min_advance_hours: 0,
      max_advance_days: 7,
      requires_training: false,
      allow_recurring: true,
    },
    color: '#8B5CF6',
  },
  {
    name: 'Underwater Camera Rig',
    description: 'Canon EOS R5 in Nauticam housing with dual strobes for reef surveys',
    category: 'field_gear',
    location: 'Field Equipment Storage, Marine Lab',
    status: 'available',
    specifications: '45MP full-frame. Video: 8K. Housing rated to 100m. Dual Inon Z-330 strobes',
    booking_rules: {
      max_duration_hours: 24,
      min_advance_hours: 24,
      max_advance_days: 60,
      requires_training: true,
      allow_recurring: false,
    },
    color: '#06B6D4',
  },
  {
    name: 'High-Performance Computing Node',
    description: 'Dedicated compute node for bioinformatics and statistical analysis',
    category: 'computing',
    location: 'Server Room, IT Building',
    status: 'available',
    specifications: '64-core AMD EPYC, 512GB RAM, 4x NVIDIA A100 GPUs, 10TB NVMe storage',
    booking_rules: {
      max_duration_hours: 72,
      min_advance_hours: 4,
      max_advance_days: 14,
      requires_training: false,
      allow_recurring: true,
    },
    color: '#6366F1',
  },
];

/** Equipment color palette for custom colors */
export const EQUIPMENT_COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#64748B', // Slate
  '#84CC16', // Lime
  '#14B8A6', // Teal
];

/** Default time range for the calendar grid */
export const DEFAULT_CALENDAR_HOURS = {
  start: 8,  // 8 AM
  end: 20,   // 8 PM
};

/** Time slot granularity in minutes */
export const TIME_SLOT_MINUTES = 30;
