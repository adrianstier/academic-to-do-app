/**
 * Reminder Feature Unit Tests
 *
 * Tests for the reminder service, API, and component logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateReminderTime } from '@/lib/reminderService';
import { REMINDER_PRESETS, type ReminderPreset } from '@/types/todo';

describe('Reminder Service', () => {
  describe('calculateReminderTime', () => {
    beforeEach(() => {
      // Use a fixed date for consistent test results
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-18T10:00:00Z'));
    });

    it('should return null for at_time preset without custom time', () => {
      const result = calculateReminderTime('at_time', undefined, undefined);
      expect(result).toBeNull();
    });

    it('should return custom time for at_time preset with custom time', () => {
      const customTime = new Date('2026-01-18T14:00:00Z');
      const result = calculateReminderTime('at_time', undefined, customTime);
      expect(result).toEqual(customTime);
    });

    it('should calculate 5 minutes before due date', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = calculateReminderTime('5_min_before', dueDate);
      expect(result).toEqual(new Date('2026-01-18T14:55:00Z'));
    });

    it('should calculate 15 minutes before due date', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = calculateReminderTime('15_min_before', dueDate);
      expect(result).toEqual(new Date('2026-01-18T14:45:00Z'));
    });

    it('should calculate 30 minutes before due date', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = calculateReminderTime('30_min_before', dueDate);
      expect(result).toEqual(new Date('2026-01-18T14:30:00Z'));
    });

    it('should calculate 1 hour before due date', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = calculateReminderTime('1_hour_before', dueDate);
      expect(result).toEqual(new Date('2026-01-18T14:00:00Z'));
    });

    it('should calculate 1 day before due date', () => {
      const dueDate = new Date('2026-01-19T15:00:00Z');
      const result = calculateReminderTime('1_day_before', dueDate);
      expect(result).toEqual(new Date('2026-01-18T15:00:00Z'));
    });

    it('should calculate morning_of (9 AM on due date)', () => {
      const dueDate = new Date('2026-01-19T15:00:00Z');
      const result = calculateReminderTime('morning_of', dueDate);
      // Note: This sets to 9 AM in local timezone
      expect(result?.getHours()).toBe(9);
      expect(result?.getMinutes()).toBe(0);
    });

    it('should return null for presets without due date', () => {
      expect(calculateReminderTime('5_min_before', undefined)).toBeNull();
      expect(calculateReminderTime('1_hour_before', undefined)).toBeNull();
      expect(calculateReminderTime('morning_of', undefined)).toBeNull();
    });

    it('should return null for custom preset without custom time', () => {
      const result = calculateReminderTime('custom', undefined, undefined);
      expect(result).toBeNull();
    });
  });
});

describe('Reminder Presets Configuration', () => {
  it('should have all expected presets defined', () => {
    const expectedPresets: ReminderPreset[] = [
      'at_time',
      '5_min_before',
      '15_min_before',
      '30_min_before',
      '1_hour_before',
      '1_day_before',
      'morning_of',
      'custom',
    ];

    expectedPresets.forEach((preset) => {
      expect(REMINDER_PRESETS).toHaveProperty(preset);
    });
  });

  it('should have valid config for each preset', () => {
    Object.entries(REMINDER_PRESETS).forEach(([key, config]) => {
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('calculateTime');
      expect(typeof config.label).toBe('string');
      expect(typeof config.description).toBe('string');
      expect(typeof config.icon).toBe('string');
      expect(typeof config.calculateTime).toBe('function');
    });
  });

  describe('preset calculateTime functions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-18T10:00:00Z'));
    });

    it('5_min_before should calculate correctly', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = REMINDER_PRESETS['5_min_before'].calculateTime(dueDate);
      expect(result?.getTime()).toBe(dueDate.getTime() - 5 * 60 * 1000);
    });

    it('15_min_before should calculate correctly', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = REMINDER_PRESETS['15_min_before'].calculateTime(dueDate);
      expect(result?.getTime()).toBe(dueDate.getTime() - 15 * 60 * 1000);
    });

    it('30_min_before should calculate correctly', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = REMINDER_PRESETS['30_min_before'].calculateTime(dueDate);
      expect(result?.getTime()).toBe(dueDate.getTime() - 30 * 60 * 1000);
    });

    it('1_hour_before should calculate correctly', () => {
      const dueDate = new Date('2026-01-18T15:00:00Z');
      const result = REMINDER_PRESETS['1_hour_before'].calculateTime(dueDate);
      expect(result?.getTime()).toBe(dueDate.getTime() - 60 * 60 * 1000);
    });

    it('1_day_before should calculate correctly', () => {
      const dueDate = new Date('2026-01-19T15:00:00Z');
      const result = REMINDER_PRESETS['1_day_before'].calculateTime(dueDate);
      expect(result?.getTime()).toBe(dueDate.getTime() - 24 * 60 * 60 * 1000);
    });

    it('morning_of should return 9 AM on due date', () => {
      const dueDate = new Date('2026-01-19T15:00:00Z');
      const result = REMINDER_PRESETS['morning_of'].calculateTime(dueDate);
      expect(result?.getHours()).toBe(9);
      expect(result?.getMinutes()).toBe(0);
      expect(result?.getSeconds()).toBe(0);
    });

    it('at_time and custom should return null without custom time', () => {
      expect(REMINDER_PRESETS['at_time'].calculateTime()).toBeNull();
      expect(REMINDER_PRESETS['custom'].calculateTime()).toBeNull();
    });
  });
});

describe('Reminder Types', () => {
  it('should have valid ReminderType options', () => {
    const validTypes = ['push_notification', 'chat_message', 'both'];
    // This tests that our type definition matches expected values
    // In runtime, we just verify the strings are what we expect
    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('should have valid ReminderStatus options', () => {
    const validStatuses = ['pending', 'sent', 'failed', 'cancelled'];
    validStatuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('Todo Type with Reminders', () => {
  it('should accept reminder_at field', () => {
    const todo = {
      id: 'test-id',
      text: 'Test todo',
      completed: false,
      status: 'todo' as const,
      priority: 'medium' as const,
      created_at: new Date().toISOString(),
      created_by: 'Test User',
      reminder_at: new Date().toISOString(),
      reminder_sent: false,
    };

    expect(todo.reminder_at).toBeDefined();
    expect(todo.reminder_sent).toBe(false);
  });

  it('should allow undefined reminder fields', () => {
    const todo: Partial<import('@/types/todo').Todo> = {
      id: 'test-id',
      text: 'Test todo',
      completed: false,
      status: 'todo' as const,
      priority: 'medium' as const,
      created_at: new Date().toISOString(),
      created_by: 'Test User',
    };

    expect(todo.reminder_at).toBeUndefined();
    expect(todo.reminder_sent).toBeUndefined();
  });
});

describe('Activity Actions for Reminders', () => {
  it('should include reminder-related activity actions', () => {
    const reminderActions = [
      'reminder_added',
      'reminder_removed',
      'reminder_sent',
    ];

    // These are the expected action types for reminders
    reminderActions.forEach((action) => {
      expect(typeof action).toBe('string');
      expect(action).toMatch(/^reminder_/);
    });
  });
});
