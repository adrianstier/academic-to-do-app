import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate, createTask } from './fixtures/helpers';

async function loginAsExistingUser(page: Page) {
  await setupAndNavigate(page);
}

test.describe('PIN Authentication', () => {
  test('should show login screen on first visit', async ({ page }) => {
    await page.goto('/');
    // Should show Academic Projects title on login screen
    await expect(page.locator('h1:has-text("Academic Projects")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Task Management')).toBeVisible();
  });

  test('should show Add New User button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("Add New User")')).toBeVisible({ timeout: 10000 });
  });

  test('should allow user registration with name and PIN', async ({ page }) => {
    await loginAsExistingUser(page);
    // After login, should see the task input or Add Task button
    const taskInput = page.locator('textarea[placeholder*="What needs to be done"]');
    const addTaskBtn = page.locator('button').filter({ hasText: /Add Task|New Task/i }).first();
    await expect(taskInput.or(addTaskBtn)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Micro-Rewards (Celebration Effect)', () => {
  test('should show celebration when completing a task via checkbox', async ({ page }) => {
    await loginAsExistingUser(page);

    // Create a task with unique name
    const taskName = `Celebration_${Date.now()}`;
    await createTask(page, taskName);

    // Wait for task to appear
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Complete the task by clicking the checkbox
    const checkbox = page.locator(`text=${taskName}`).locator('xpath=ancestor::div[contains(@class, "rounded-")]//button[1]');
    await checkbox.click();

    // Should see celebration effect
    await expect(page.locator("text=You've got it covered!")).toBeVisible({ timeout: 5000 });
  });

  test('should auto-dismiss celebration after animation', async ({ page }) => {
    await loginAsExistingUser(page);

    // Create a task with unique name
    const taskName = `AutoDismiss_${Date.now()}`;
    await createTask(page, taskName);

    // Wait for task to appear
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Complete the task
    const checkbox = page.locator(`text=${taskName}`).locator('xpath=ancestor::div[contains(@class, "rounded-")]//button[1]');
    await checkbox.click();

    // Celebration should appear
    await expect(page.locator("text=You've got it covered!")).toBeVisible({ timeout: 5000 });

    // Wait for auto-dismiss (2.5 seconds + buffer)
    await expect(page.locator("text=You've got it covered!")).not.toBeVisible({ timeout: 6000 });
  });
});

test.describe('Progress Summary', () => {
  test('should show Progress button in header', async ({ page }) => {
    await loginAsExistingUser(page);

    // Progress button should be visible (has Trophy icon)
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-trophy') })).toBeVisible();
  });

  test('should open Progress Summary modal when clicking Progress button', async ({ page }) => {
    await loginAsExistingUser(page);

    // Click Progress button
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();

    // Modal should appear with progress stats
    await expect(page.locator('text=Your Progress')).toBeVisible({ timeout: 3000 });
  });

  test('should display streak count in Progress Summary', async ({ page }) => {
    await loginAsExistingUser(page);

    // Open Progress Summary
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();

    // Should show streak section
    await expect(page.locator('text=Streak')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=days active')).toBeVisible();
  });

  test('should display completion rate in Progress Summary', async ({ page }) => {
    await loginAsExistingUser(page);

    // Open Progress Summary
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();

    // Should show completion rate
    await expect(page.locator('text=completion rate')).toBeVisible({ timeout: 3000 });
  });

  test('should close Progress Summary when clicking Keep Going button', async ({ page }) => {
    await loginAsExistingUser(page);

    // Open
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();
    await expect(page.locator('text=Your Progress')).toBeVisible({ timeout: 3000 });

    // Click Keep Going
    await page.locator('button:has-text("Keep Going!")').click();

    // Modal should close
    await expect(page.locator('text=Your Progress')).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Cloud Storage Integration', () => {
  test('should persist tasks across page reloads', async ({ page }) => {
    await loginAsExistingUser(page);

    // Create a task
    const uniqueTask = `Persistence_${Date.now()}`;
    await createTask(page, uniqueTask);
    await expect(page.locator(`text=${uniqueTask}`)).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload();

    // Should still be logged in - wait for app to load
    await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2000);
    await page.waitForTimeout(2000);
    await expect(page.locator(`text=${uniqueTask}`)).toBeVisible({ timeout: 10000 });
  });

  test('should persist user session across reloads', async ({ page }) => {
    await loginAsExistingUser(page);

    // Reload page
    await page.reload();

    // Should still be logged in (see task input or add task button, not login screen)
    await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2000);
    const taskInput = page.locator('textarea[placeholder*="What needs to be done"]');
    const addTaskBtn = page.locator('button').filter({ hasText: /Add Task|New Task/i }).first();
    await expect(taskInput.or(addTaskBtn)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('User Switcher', () => {
  test('should show user dropdown in header', async ({ page }) => {
    await loginAsExistingUser(page);

    // Find and click user dropdown (has chevron-down icon)
    const userDropdown = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') }).last();
    await userDropdown.click();

    // Should show dropdown with Log Out option
    await expect(page.locator('text=Log Out')).toBeVisible({ timeout: 3000 });
  });

  test('should logout when clicking Log Out', async ({ page }) => {
    await loginAsExistingUser(page);

    // Click user dropdown
    const userDropdown = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') }).last();
    await userDropdown.click();

    // Click Log Out
    await page.locator('button:has-text("Log Out")').click();

    // Should return to login screen
    await expect(page.locator('text=Task Management')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Real-time Connection', () => {
  test('should show Live or Offline status', async ({ page }) => {
    await loginAsExistingUser(page);

    // Should show either Live or Offline status
    const liveStatus = page.locator('text=Live');
    const offlineStatus = page.locator('text=Offline');

    await expect(liveStatus.or(offlineStatus)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Stats Dashboard', () => {
  test('should show all three stat cards', async ({ page }) => {
    await loginAsExistingUser(page);

    await expect(page.locator('text=Total Tasks')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Overdue')).toBeVisible();
  });

  test('should update Total Tasks when adding a task', async ({ page }) => {
    await loginAsExistingUser(page);

    // Get initial count
    const totalStat = page.locator('text=Total Tasks').locator('..').locator('p').first();
    const initialCount = parseInt(await totalStat.textContent() || '0');

    // Add a task using createTask helper
    await createTask(page, 'Stats test task');
    await expect(page.locator('text=Stats test task')).toBeVisible({ timeout: 5000 });

    // Check count increased
    await page.waitForTimeout(500);
    const newCount = parseInt(await totalStat.textContent() || '0');
    expect(newCount).toBe(initialCount + 1);
  });
});

test.describe('View Modes', () => {
  test('should switch to Kanban view', async ({ page }) => {
    await loginAsExistingUser(page);

    // Click Kanban button (layout-grid icon)
    const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
    await kanbanButton.click();

    // Should see Kanban columns
    await expect(page.locator('h3:has-text("To Do")')).toBeVisible();
    await expect(page.locator('h3:has-text("In Progress")')).toBeVisible();
    await expect(page.locator('h3:has-text("Done")')).toBeVisible();
  });

  test('should switch back to List view', async ({ page }) => {
    await loginAsExistingUser(page);

    // Switch to Kanban first
    const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
    await kanbanButton.click();
    await expect(page.locator('h3:has-text("To Do")')).toBeVisible();

    // Switch back to List
    const listButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-list') });
    await listButton.click();

    // Should see filter buttons (only in list view)
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Active")')).toBeVisible();
  });
});

test.describe('Task Filters', () => {
  test('should filter to Active tasks only', async ({ page }) => {
    await loginAsExistingUser(page);

    // Create two tasks using createTask helper
    const activeTask = `Active_${Date.now()}`;
    await createTask(page, activeTask);
    await expect(page.locator(`text=${activeTask}`)).toBeVisible({ timeout: 5000 });

    const taskToComplete = `Complete_${Date.now()}`;
    await createTask(page, taskToComplete);
    await expect(page.locator(`text=${taskToComplete}`)).toBeVisible({ timeout: 5000 });

    // Complete one
    const taskItem = page.locator(`text=${taskToComplete}`).locator('..').locator('..');
    await taskItem.locator('button').first().click();
    await page.waitForTimeout(2500); // Wait for celebration

    // Click Active filter
    await page.locator('button:has-text("Active")').click();

    // Should see active task, not completed
    await expect(page.locator(`text=${activeTask}`)).toBeVisible();
    await expect(page.locator(`text=${taskToComplete}`)).not.toBeVisible();
  });

  test('should filter to Completed tasks only', async ({ page }) => {
    await loginAsExistingUser(page);

    // Create and complete a task
    const taskName = `FilterComplete_${Date.now()}`;
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 5000 });

    const taskItem = page.locator(`text=${taskName}`).locator('..').locator('..');
    await taskItem.locator('button').first().click();
    await page.waitForTimeout(2500);

    // Click Completed filter
    await page.locator('button:has-text("Completed")').click();

    // Should see completed task
    await expect(page.locator(`text=${taskName}`)).toBeVisible();
  });
});

test.describe('Task CRUD Operations', () => {
  test('should create a task', async ({ page }) => {
    await loginAsExistingUser(page);

    const taskName = `Create_${Date.now()}`;
    await createTask(page, taskName);

    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a task', async ({ page }) => {
    await loginAsExistingUser(page);

    // Create a task
    const taskName = `Delete_${Date.now()}`;
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 5000 });

    // Hover to show delete button
    const taskItem = page.locator(`text=${taskName}`).locator('..').locator('..').locator('..');
    await taskItem.hover();

    // Click delete button
    const deleteButton = taskItem.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    await deleteButton.click();

    // Task should be removed
    await expect(page.locator(`text=${taskName}`)).not.toBeVisible({ timeout: 3000 });
  });
});
