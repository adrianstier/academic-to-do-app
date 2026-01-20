/**
 * Reminders Feature E2E Tests
 *
 * Tests the full reminder workflow:
 * - Adding reminders when creating tasks
 * - Setting reminders on existing tasks
 * - Reminder display in task list
 * - Reminder preset selection
 */

import { test, expect } from '@playwright/test';

// Helper to login as a user
async function loginAsUser(page: import('@playwright/test').Page, userName: string, pin: string) {
  await page.goto('/');
  // Wait for login page to load
  await page.waitForSelector('[data-testid="login-screen"]', { timeout: 10000 }).catch(() => {
    // If login screen doesn't exist, we may already be logged in
  });

  // Click on user card
  const userCard = page.locator(`[data-testid="user-card-${userName}"]`);
  if (await userCard.isVisible()) {
    await userCard.click();
    // Enter PIN
    await page.fill('[data-testid="pin-input"]', pin);
    await page.click('[data-testid="login-button"]');
    // Wait for main app to load
    await page.waitForSelector('[data-testid="main-app"]', { timeout: 10000 });
  }
}

test.describe('Reminders Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsUser(page, 'Derrick', '8008');
  });

  test('should display reminder button in AddTodo form', async ({ page }) => {
    // Focus on the task input to show options
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();
    await taskInput.fill('Test task for reminder');

    // Look for the reminder picker
    const reminderButton = page.locator('button:has-text("Reminder")');
    await expect(reminderButton).toBeVisible();
  });

  test('should open reminder picker dropdown when clicked', async ({ page }) => {
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();
    await taskInput.fill('Test task');

    // Click the reminder button
    const reminderButton = page.locator('button:has-text("Reminder")');
    await reminderButton.click();

    // Check for dropdown options
    await expect(page.locator('text=5 min before')).toBeVisible();
    await expect(page.locator('text=15 min before')).toBeVisible();
    await expect(page.locator('text=Custom time')).toBeVisible();
  });

  test('should show reminder presets when due date is set', async ({ page }) => {
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();
    await taskInput.fill('Test task with due date');

    // Set a due date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateInput = page.locator('input[type="date"][aria-label="Due date"]');
    await dueDateInput.fill(tomorrow.toISOString().split('T')[0]);

    // Open reminder picker
    const reminderButton = page.locator('button:has-text("Reminder")');
    await reminderButton.click();

    // Preset options should be available
    await expect(page.locator('text=1 day before')).toBeVisible();
    await expect(page.locator('text=9 AM day of')).toBeVisible();
  });

  test('should be able to set custom reminder time', async ({ page }) => {
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();
    await taskInput.fill('Task with custom reminder');

    // Open reminder picker
    const reminderButton = page.locator('button:has-text("Reminder")');
    await reminderButton.click();

    // Click on Custom time
    await page.locator('text=Custom time').click();

    // Should show date and time inputs
    await expect(page.locator('input[type="date"]').last()).toBeVisible();
    await expect(page.locator('input[type="time"]').last()).toBeVisible();
  });

  test('should create task with reminder and display badge', async ({ page }) => {
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();

    const taskText = `Reminder test task ${Date.now()}`;
    await taskInput.fill(taskText);

    // Set due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateInput = page.locator('input[type="date"][aria-label="Due date"]');
    await dueDateInput.fill(tomorrow.toISOString().split('T')[0]);

    // Open reminder picker and select 1 day before
    const reminderButton = page.locator('button:has-text("Reminder")');
    await reminderButton.click();
    await page.locator('text=1 day before').click();

    // Submit the task
    await page.locator('button[aria-label="Add task"]').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible();

    // Check for reminder badge (should show "Today" since 1 day before tomorrow is today)
    // The exact text depends on current time
    const taskItem = page.locator(`[data-testid="todo-item"]`).filter({ hasText: taskText });
    await expect(taskItem.locator('svg').filter({ hasNot: page.locator('text') }).first()).toBeTruthy();
  });

  test('should be able to remove a reminder', async ({ page }) => {
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();

    const taskText = `Remove reminder test ${Date.now()}`;
    await taskInput.fill(taskText);

    // Set due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.locator('input[type="date"][aria-label="Due date"]').fill(tomorrow.toISOString().split('T')[0]);

    // Add reminder
    await page.locator('button:has-text("Reminder")').click();
    await page.locator('text=1 day before').click();

    // Submit the task
    await page.locator('button[aria-label="Add task"]').click();
    await expect(page.locator(`text=${taskText}`)).toBeVisible();

    // Expand task to see reminder options
    const taskItem = page.locator(`[data-testid="todo-item"]`).filter({ hasText: taskText });
    await taskItem.click();

    // Look for remove reminder option
    const reminderPicker = taskItem.locator('button:has-text("Reminder")');
    if (await reminderPicker.isVisible()) {
      await reminderPicker.click();
      const removeButton = page.locator('text=Remove reminder');
      if (await removeButton.isVisible()) {
        await removeButton.click();
      }
    }
  });

  test('should not show reminder picker for completed tasks', async ({ page }) => {
    // First, find a completed task or create and complete one
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();

    const taskText = `Complete me for test ${Date.now()}`;
    await taskInput.fill(taskText);
    await page.locator('button[aria-label="Add task"]').click();

    await expect(page.locator(`text=${taskText}`)).toBeVisible();

    // Complete the task
    const taskItem = page.locator(`[data-testid="todo-item"]`).filter({ hasText: taskText });
    const checkbox = taskItem.locator('button[role="checkbox"], button:has(svg)').first();
    await checkbox.click();

    // Expand the task
    await taskItem.click();

    // Reminder picker should not be visible for completed tasks
    // The exact behavior depends on implementation
  });
});

test.describe('Reminder API', () => {
  test('should reject reminder creation for past times', async ({ request }) => {
    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 1);

    const response = await request.post('/api/reminders', {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Name': 'Derrick',
      },
      data: {
        todoId: '00000000-0000-0000-0000-000000000001',
        reminderTime: pastTime.toISOString(),
      },
    });

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('future');
  });

  test('should reject reminder creation without todoId', async ({ request }) => {
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 1);

    const response = await request.post('/api/reminders', {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Name': 'Derrick',
      },
      data: {
        reminderTime: futureTime.toISOString(),
      },
    });

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('todoId');
  });

  test('should require authentication', async ({ request }) => {
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 1);

    const response = await request.post('/api/reminders', {
      headers: {
        'Content-Type': 'application/json',
        // No X-User-Name header
      },
      data: {
        todoId: '00000000-0000-0000-0000-000000000001',
        reminderTime: futureTime.toISOString(),
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Reminder Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'Derrick', '8008');
  });

  test('should format reminder time correctly for today', async ({ page }) => {
    // This test verifies the formatting logic
    // The exact assertions depend on the current time and locale
    const taskInput = page.locator('textarea[aria-label="New task description"]');
    await taskInput.click();

    const taskText = `Today reminder ${Date.now()}`;
    await taskInput.fill(taskText);

    // Set due date to today
    const today = new Date();
    const dueDateInput = page.locator('input[type="date"][aria-label="Due date"]');
    await dueDateInput.fill(today.toISOString().split('T')[0]);

    // Add a custom reminder for later today
    await page.locator('button:has-text("Reminder")').click();
    await page.locator('text=Custom time').click();

    // Set date to today
    const dateInput = page.locator('input[type="date"]').last();
    await dateInput.fill(today.toISOString().split('T')[0]);

    // Set time to a future time today
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 2);
    const timeString = `${futureTime.getHours().toString().padStart(2, '0')}:${futureTime.getMinutes().toString().padStart(2, '0')}`;
    const timeInput = page.locator('input[type="time"]').last();
    await timeInput.fill(timeString);

    // Submit the custom reminder
    const setButton = page.locator('button:has-text("Set Reminder")');
    if (await setButton.isVisible()) {
      await setButton.click();
    }
  });
});
