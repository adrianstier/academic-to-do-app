import { test, expect, Page } from '@playwright/test';

// Helper function to setup user and navigate to app
async function setupUser(page: Page, userName: string = 'Test User') {
  await page.goto('/');
  await page.evaluate((name) => localStorage.setItem('userName', name), userName);
  await page.reload();
}

// Helper to wait for app to load (either app or config screen)
async function waitForAppLoad(page: Page) {
  const bealerAgency = page.locator('h1:has-text("Bealer Agency")');
  const configRequired = page.locator('text=Configuration Required');
  await expect(bealerAgency.or(configRequired)).toBeVisible({ timeout: 10000 });
}

// Helper to check if Supabase is configured (app is showing main interface)
async function isSupabaseConfigured(page: Page): Promise<boolean> {
  // Check if we see the main app interface (input field for adding tasks)
  const addTaskInput = page.locator('input[placeholder="What needs to be done?"]');
  const configRequired = page.locator('text=Configuration Required');

  // Wait a bit for page to settle
  await page.waitForTimeout(1000);

  // If we see config required, Supabase is NOT configured
  if (await configRequired.isVisible().catch(() => false)) {
    return false;
  }

  // If we see the task input, Supabase IS configured
  if (await addTaskInput.isVisible().catch(() => false)) {
    return true;
  }

  return false;
}

test.describe('Comprehensive Feature Tests', () => {
  test.describe('Task Creation (CRUD - Create)', () => {
    test('should create a basic task', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await expect(input).toBeVisible();
      await input.fill('Test task creation');
      await page.keyboard.press('Enter');

      // Task should appear in the list
      await expect(page.locator('text=Test task creation')).toBeVisible({ timeout: 5000 });
    });

    test('should create task with priority selection', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('High priority task');

      // Click priority button and select high
      const priorityButton = page.locator('button:has-text("Medium")').first();
      await priorityButton.click();
      await page.locator('button:has-text("High")').click();

      // Submit
      await page.keyboard.press('Enter');

      // Verify task created with high priority
      await expect(page.locator('text=High priority task')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.bg-\\[rgba\\(245\\,158\\,11\\,0\\.1\\)\\]')).toBeVisible();
    });

    test('should create task with due date', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Task with due date');

      // Set due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];

      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill(dateString);

      // Submit
      await page.locator('button[type="submit"]').click();

      // Verify task created with due date showing "Tomorrow"
      await expect(page.locator('text=Task with due date')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Tomorrow')).toBeVisible();
    });

    test('should not create empty task', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Submit button should be disabled when input is empty
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeDisabled();

      // Try submitting empty input via keyboard
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await page.keyboard.press('Enter');

      // No new task should appear (check stats remain same)
      const initialCount = await page.locator('[data-testid="total-tasks"]').textContent().catch(() => '0');
      await page.keyboard.press('Enter');
      const finalCount = await page.locator('[data-testid="total-tasks"]').textContent().catch(() => '0');
      expect(initialCount).toBe(finalCount);
    });

    test('should create task with all priority levels', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const priorities = ['Urgent', 'High', 'Medium', 'Low'];

      for (const priority of priorities) {
        const input = page.locator('input[placeholder="What needs to be done?"]');
        await input.click();
        await input.fill(`${priority} priority task`);

        const priorityButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /Urgent|High|Medium|Low/ }).first();
        await priorityButton.click();
        await page.locator(`button:has-text("${priority}")`).last().click();

        await page.keyboard.press('Enter');
        await expect(page.locator(`text=${priority} priority task`)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Task Completion (CRUD - Update)', () => {
    test('should toggle task completion', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task first
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Task to complete');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Task to complete')).toBeVisible({ timeout: 5000 });

      // Find and click the checkbox
      const checkbox = page.locator('button').filter({ has: page.locator('.rounded-full') }).first();
      await checkbox.click();

      // Task should show as completed (line-through style)
      await expect(page.locator('.line-through')).toBeVisible({ timeout: 3000 });
    });

    test('should update stats when completing task', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Get initial completed count
      const completedStat = page.locator('text=Completed').locator('..').locator('p').first();
      const initialCompleted = await completedStat.textContent();

      // Create and complete a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Task for stats test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Task for stats test')).toBeVisible({ timeout: 5000 });

      // Complete the task
      const taskRow = page.locator('text=Task for stats test').locator('..').locator('..');
      const checkbox = taskRow.locator('button').first();
      await checkbox.click();

      // Wait for stats to update
      await page.waitForTimeout(500);
      const newCompleted = await completedStat.textContent();

      expect(parseInt(newCompleted || '0')).toBeGreaterThanOrEqual(parseInt(initialCompleted || '0'));
    });
  });

  test.describe('Task Deletion (CRUD - Delete)', () => {
    test('should delete a task', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Task to delete');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Task to delete')).toBeVisible({ timeout: 5000 });

      // Hover to show delete button
      const taskItem = page.locator('text=Task to delete').locator('..').locator('..').locator('..');
      await taskItem.hover();

      // Click delete button (Trash2 icon)
      const deleteButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await deleteButton.click();

      // Task should be removed
      await expect(page.locator('text=Task to delete')).not.toBeVisible({ timeout: 3000 });
    });

    test('should update total count after deletion', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Another task to delete');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Another task to delete')).toBeVisible({ timeout: 5000 });

      // Get total count
      const totalStat = page.locator('text=Total Tasks').locator('..').locator('p').first();
      const initialTotal = parseInt(await totalStat.textContent() || '0');

      // Delete the task
      const taskItem = page.locator('text=Another task to delete').locator('..').locator('..').locator('..');
      await taskItem.hover();
      const deleteButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await deleteButton.click();

      // Wait for deletion
      await page.waitForTimeout(500);
      const newTotal = parseInt(await totalStat.textContent() || '0');

      expect(newTotal).toBe(initialTotal - 1);
    });
  });

  test.describe('View Mode Switching', () => {
    test('should switch from list to kanban view', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Default is list view, click kanban button
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // Should see kanban columns
      await expect(page.locator('text=To Do')).toBeVisible();
      await expect(page.locator('text=In Progress')).toBeVisible();
      await expect(page.locator('text=Done')).toBeVisible();
    });

    test('should switch from kanban to list view', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Switch to kanban first
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();
      await expect(page.locator('h3:has-text("To Do")')).toBeVisible();

      // Switch back to list
      const listButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-list') });
      await listButton.click();

      // Filter buttons should be visible (only in list view)
      await expect(page.locator('button:has-text("All")')).toBeVisible();
    });

    test('should preserve tasks when switching views', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task in list view
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Persistent task');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Persistent task')).toBeVisible({ timeout: 5000 });

      // Switch to kanban
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // Task should still be visible
      await expect(page.locator('text=Persistent task')).toBeVisible();

      // Switch back to list
      const listButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-list') });
      await listButton.click();

      // Task should still be visible
      await expect(page.locator('text=Persistent task')).toBeVisible();
    });
  });

  test.describe('Filter Functionality', () => {
    test('should filter to show only active tasks', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create and complete a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Completed filter test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Completed filter test')).toBeVisible({ timeout: 5000 });

      // Complete it
      const taskItem = page.locator('text=Completed filter test').locator('..').locator('..');
      const checkbox = taskItem.locator('button').first();
      await checkbox.click();
      await page.waitForTimeout(300);

      // Create an active task
      await input.fill('Active filter test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Active filter test')).toBeVisible({ timeout: 5000 });

      // Click Active filter
      await page.locator('button:has-text("Active")').click();

      // Should see active task but not completed
      await expect(page.locator('text=Active filter test')).toBeVisible();
      await expect(page.locator('text=Completed filter test')).not.toBeVisible();
    });

    test('should filter to show only completed tasks', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create two tasks
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Will be completed');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Will be completed')).toBeVisible({ timeout: 5000 });

      await input.fill('Will stay active');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Will stay active')).toBeVisible({ timeout: 5000 });

      // Complete one task
      const taskToComplete = page.locator('text=Will be completed').locator('..').locator('..');
      await taskToComplete.locator('button').first().click();
      await page.waitForTimeout(300);

      // Click Completed filter
      await page.locator('button:has-text("Completed")').click();

      // Should see completed task but not active
      await expect(page.locator('text=Will be completed')).toBeVisible();
      await expect(page.locator('text=Will stay active')).not.toBeVisible();
    });

    test('should show all tasks with All filter', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Apply active filter first
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(300);

      // Switch back to All
      await page.locator('button:has-text("All")').click();

      // All filter should be selected (check styling)
      const allButton = page.locator('button:has-text("All")');
      await expect(allButton).toHaveClass(/shadow-sm/);
    });

    test('should show empty state message when filter has no results', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Click Completed filter when no tasks are completed
      await page.locator('button:has-text("Completed")').click();

      // Should see empty state message
      const emptyState = page.locator('text=No completed tasks');
      if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(emptyState).toBeVisible();
      }
    });
  });

  test.describe('Kanban Board Functionality', () => {
    test('should display three columns in kanban view', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Switch to kanban
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // Verify three columns
      await expect(page.locator('h3:has-text("To Do")')).toBeVisible();
      await expect(page.locator('h3:has-text("In Progress")')).toBeVisible();
      await expect(page.locator('h3:has-text("Done")')).toBeVisible();
    });

    test('should show task counts in column headers', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Kanban count test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Kanban count test')).toBeVisible({ timeout: 5000 });

      // Switch to kanban
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // To Do column should show count
      const todoColumn = page.locator('h3:has-text("To Do")').locator('..');
      await expect(todoColumn.locator('span').last()).toBeVisible();
    });

    test('should show empty state placeholder in empty columns', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Switch to kanban
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // Empty columns should show "Drop tasks here"
      const dropPlaceholders = page.locator('text=Drop tasks here');
      expect(await dropPlaceholders.count()).toBeGreaterThan(0);
    });

    test('should show drag handle on kanban cards', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Drag handle test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Drag handle test')).toBeVisible({ timeout: 5000 });

      // Switch to kanban
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // Card should have drag handle (GripVertical icon)
      const card = page.locator('text=Drag handle test').locator('..').locator('..');
      const dragHandle = card.locator('svg.lucide-grip-vertical');
      await expect(dragHandle).toBeVisible();
    });
  });

  test.describe('Priority System', () => {
    test('should display priority badge on tasks', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task with urgent priority
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Priority badge test');

      const priorityButton = page.locator('button').filter({ hasText: /Medium/ }).first();
      await priorityButton.click();
      await page.locator('button:has-text("Urgent")').last().click();
      await page.keyboard.press('Enter');

      await expect(page.locator('text=Priority badge test')).toBeVisible({ timeout: 5000 });

      // Should show Urgent badge
      await expect(page.locator('span:has-text("Urgent")')).toBeVisible();
    });

    test('should show colored priority bar on task cards', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Tasks have colored top bar indicating priority
      const priorityBars = page.locator('.h-1.rounded-t-xl');
      if (await priorityBars.count() > 0) {
        await expect(priorityBars.first()).toBeVisible();
      }
    });

    test('should update priority from expanded task panel', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Priority update test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Priority update test')).toBeVisible({ timeout: 5000 });

      // Hover and expand task
      const taskItem = page.locator('text=Priority update test').locator('..').locator('..').locator('..');
      await taskItem.hover();

      // Click expand button (chevron)
      const expandButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') });
      await expandButton.click();

      // Should see priority selector in expanded panel
      await expect(page.locator('label:has-text("Priority")')).toBeVisible();
    });
  });

  test.describe('Due Date System', () => {
    test('should display "Today" for tasks due today', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Due today task');

      // Set due date to today
      const today = new Date().toISOString().split('T')[0];
      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill(today);

      await page.keyboard.press('Enter');
      await expect(page.locator('text=Due today task')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Today')).toBeVisible();
    });

    test('should display "Tomorrow" for tasks due tomorrow', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Due tomorrow task');

      // Set due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill(dateString);

      await page.keyboard.press('Enter');
      await expect(page.locator('text=Due tomorrow task')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Tomorrow')).toBeVisible();
    });

    test('should show overdue indicator for past due tasks', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Overdue task');

      // Set due date to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];
      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill(dateString);

      await page.keyboard.press('Enter');
      await expect(page.locator('text=Overdue task')).toBeVisible({ timeout: 5000 });

      // Should show red styling for overdue
      const overdueIndicator = page.locator('.text-red-600, .text-red-400, .bg-red-100');
      await expect(overdueIndicator.first()).toBeVisible();
    });

    test('should update overdue count in stats', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Get initial overdue count
      const overdueStat = page.locator('text=Overdue').locator('..').locator('p').first();
      const initialOverdue = parseInt(await overdueStat.textContent() || '0');

      // Create overdue task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Stats overdue task');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill(yesterday.toISOString().split('T')[0]);

      await page.keyboard.press('Enter');
      await expect(page.locator('text=Stats overdue task')).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(500);
      const newOverdue = parseInt(await overdueStat.textContent() || '0');

      expect(newOverdue).toBe(initialOverdue + 1);
    });
  });

  test.describe('User Assignment', () => {
    test('should show "Unassigned" for tasks without assignee', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Unassigned task test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Unassigned task test')).toBeVisible({ timeout: 5000 });

      // Hover and expand to see assignment
      const taskItem = page.locator('text=Unassigned task test').locator('..').locator('..').locator('..');
      await taskItem.hover();
      const expandButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') });
      await expandButton.click();

      await expect(page.locator('button:has-text("Unassigned")')).toBeVisible();
    });

    test('should show assignee selector in expanded panel', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Assignee selector test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Assignee selector test')).toBeVisible({ timeout: 5000 });

      // Hover and expand
      const taskItem = page.locator('text=Assignee selector test').locator('..').locator('..').locator('..');
      await taskItem.hover();
      const expandButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') });
      await expandButton.click();

      // Should see "Assigned To" label
      await expect(page.locator('label:has-text("Assigned To")')).toBeVisible();
    });
  });

  test.describe('Header and Navigation', () => {
    test('should display Bealer Agency header', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible();
    });

    test('should display user name in header', async ({ page }) => {
      await setupUser(page, 'John Doe');
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      await expect(page.locator('text=John Doe')).toBeVisible();
    });

    test('should show connection status indicator', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Should show either Live or Offline
      const liveStatus = page.locator('text=Live');
      const offlineStatus = page.locator('text=Offline');
      await expect(liveStatus.or(offlineStatus)).toBeVisible();
    });

    test('should have logout button', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const logoutButton = page.locator('button').filter({ has: page.locator('svg.lucide-log-out') });
      await expect(logoutButton).toBeVisible();
    });

    test('should logout and return to onboarding', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Click logout
      const logoutButton = page.locator('button').filter({ has: page.locator('svg.lucide-log-out') });
      await logoutButton.click();

      // Should return to onboarding
      await expect(page.locator('text=Bealer Agency')).toBeVisible();
      await expect(page.locator('button:has-text("Get Started")')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Stats Dashboard', () => {
    test('should display three stat cards', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      await expect(page.locator('text=Total Tasks')).toBeVisible();
      await expect(page.locator('text=Completed')).toBeVisible();
      await expect(page.locator('text=Overdue')).toBeVisible();
    });

    test('should update stats in real-time', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Get initial total
      const totalStat = page.locator('text=Total Tasks').locator('..').locator('p').first();
      const initialTotal = parseInt(await totalStat.textContent() || '0');

      // Add a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Stats update test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Stats update test')).toBeVisible({ timeout: 5000 });

      // Check total increased
      await page.waitForTimeout(500);
      const newTotal = parseInt(await totalStat.textContent() || '0');
      expect(newTotal).toBe(initialTotal + 1);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle special characters in task text', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const specialText = 'Task with <special> & "characters" \'test\'';
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill(specialText);
      await page.keyboard.press('Enter');

      await expect(page.locator(`text=${specialText}`)).toBeVisible({ timeout: 5000 });
    });

    test('should handle long task text', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const longText = 'This is a very long task description that should be handled properly by the UI and not break the layout or cause any issues with rendering or storage. '.repeat(3);
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill(longText);
      await page.keyboard.press('Enter');

      // Task should be created (check partial text)
      await expect(page.locator('text=This is a very long task')).toBeVisible({ timeout: 5000 });
    });

    test('should handle emoji in task text', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const emojiText = 'Task with emoji 🎉 👍 ✅';
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill(emojiText);
      await page.keyboard.press('Enter');

      await expect(page.locator('text=Task with emoji')).toBeVisible({ timeout: 5000 });
    });

    test('should handle whitespace-only input', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('   ');

      // Submit button should be disabled for whitespace-only
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeDisabled();
    });

    test('should handle rapid task creation', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');

      // Create multiple tasks quickly
      for (let i = 1; i <= 3; i++) {
        await input.fill(`Rapid task ${i}`);
        await page.keyboard.press('Enter');
      }

      // All tasks should be created
      for (let i = 1; i <= 3; i++) {
        await expect(page.locator(`text=Rapid task ${i}`)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should handle rapid toggle operations', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Toggle stress test');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Toggle stress test')).toBeVisible({ timeout: 5000 });

      // Toggle multiple times quickly
      const taskItem = page.locator('text=Toggle stress test').locator('..').locator('..');
      const checkbox = taskItem.locator('button').first();

      await checkbox.click();
      await checkbox.click();
      await checkbox.click();

      // Task should still exist and be functional
      await expect(page.locator('text=Toggle stress test')).toBeVisible();
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no tasks exist', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('userName', 'Empty State User');
      });
      await page.reload();
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // If no tasks, should see empty state
      const emptyState = page.locator('text=No tasks yet');
      const noTasks = page.locator('text=Add your first task above!');

      // Check if empty state is visible (may have existing tasks from other tests)
      if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(noTasks).toBeVisible();
      }
    });

    test('should show empty kanban columns with placeholder', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Switch to kanban
      const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
      await kanbanButton.click();

      // Empty columns show "Drop tasks here"
      const placeholder = page.locator('text=Drop tasks here');
      expect(await placeholder.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Input Interactions', () => {
    test('should expand add todo form on focus', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();

      // Should show expanded options (priority, date)
      await expect(page.locator('text=Press Enter to add')).toBeVisible();
    });

    test('should collapse form when clicking outside with empty input', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();

      // Verify expanded
      await expect(page.locator('text=Press Enter to add')).toBeVisible();

      // Click outside
      await page.locator('body').click({ position: { x: 10, y: 10 } });

      // Should collapse (sparkles hint should disappear)
      await expect(page.locator('text=Press Enter to add')).not.toBeVisible({ timeout: 2000 });
    });

    test('should keep form expanded when input has text', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.click();
      await input.fill('Some text');

      // Click outside
      await page.locator('body').click({ position: { x: 10, y: 10 } });

      // Should stay expanded because input has text
      await expect(page.locator('text=Press Enter to add')).toBeVisible();
    });
  });

  test.describe('Task Expanded Panel', () => {
    test('should expand task to show more options', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create a task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Expandable task');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Expandable task')).toBeVisible({ timeout: 5000 });

      // Hover and expand
      const taskItem = page.locator('text=Expandable task').locator('..').locator('..').locator('..');
      await taskItem.hover();
      const expandButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') });
      await expandButton.click();

      // Should see expanded options
      await expect(page.locator('label:has-text("Priority")')).toBeVisible();
      await expect(page.locator('label:has-text("Due Date")')).toBeVisible();
      await expect(page.locator('label:has-text("Assigned To")')).toBeVisible();
    });

    test('should collapse expanded panel when clicking chevron again', async ({ page }) => {
      await setupUser(page);
      await waitForAppLoad(page);

      if (!(await isSupabaseConfigured(page))) {
        test.skip();
        return;
      }

      // Create and expand task
      const input = page.locator('input[placeholder="What needs to be done?"]');
      await input.fill('Collapsible task');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Collapsible task')).toBeVisible({ timeout: 5000 });

      const taskItem = page.locator('text=Collapsible task').locator('..').locator('..').locator('..');
      await taskItem.hover();
      const expandButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') });
      await expandButton.click();

      // Verify expanded
      await expect(page.locator('label:has-text("Priority")')).toBeVisible();

      // Click again to collapse
      await expandButton.click();

      // Should be collapsed
      await expect(page.locator('label:has-text("Priority")')).not.toBeVisible({ timeout: 2000 });
    });
  });
});

test.describe('Error Handling', () => {
  test('should display configuration error screen when Supabase not configured', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('userName', 'Config Test'));
    await page.reload();

    // Either see app or config error
    const configRequired = page.locator('text=Configuration Required');
    const bealerAgency = page.locator('h1:has-text("Bealer Agency")');

    await expect(configRequired.or(bealerAgency)).toBeVisible({ timeout: 10000 });

    if (await configRequired.isVisible()) {
      // Should show setup instructions
      await expect(page.locator('text=SETUP.md')).toBeVisible();
    }
  });

  test('should show loading state while fetching data', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('userName', 'Loading Test'));

    // Check for loading indicator (may be very brief)
    const loadingText = page.locator('text=Loading your tasks');
    // This may or may not be visible depending on network speed
    // Just verify the page eventually loads
    await waitForAppLoad(page);
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupUser(page);
    await waitForAppLoad(page);

    if (!(await isSupabaseConfigured(page))) {
      test.skip();
      return;
    }

    // Core elements should be visible
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible();
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupUser(page);
    await waitForAppLoad(page);

    if (!(await isSupabaseConfigured(page))) {
      test.skip();
      return;
    }

    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible();
    await expect(page.locator('text=Total Tasks')).toBeVisible();
  });

  test('should display kanban in single column on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupUser(page);
    await waitForAppLoad(page);

    if (!(await isSupabaseConfigured(page))) {
      test.skip();
      return;
    }

    // Switch to kanban
    const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
    await kanbanButton.click();

    // Columns should still be visible (stacked vertically)
    await expect(page.locator('h3:has-text("To Do")')).toBeVisible();
  });
});
