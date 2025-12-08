import { test, expect, Page } from '@playwright/test';

// Helper to register a new user and login
async function registerAndLogin(page: Page, userName: string = 'Test User', pin: string = '1234') {
  await page.goto('/');

  // Wait for login screen to load (shows "Bealer Agency" and "Task Management System")
  await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Task Management System')).toBeVisible({ timeout: 5000 });

  // Click "Add New User" button
  await page.locator('button:has-text("Add New User")').click();

  // Wait for registration screen (wait for name input to appear)
  await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible({ timeout: 5000 });

  // Fill in name
  await page.locator('input[placeholder="Enter your name"]').fill(userName);

  // Enter PIN (4 digit inputs)
  const pinInputs = page.locator('input[type="password"]');
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Enter confirm PIN
  for (let i = 4; i < 8; i++) {
    await pinInputs.nth(i).fill(pin[i - 4]);
  }

  // Click Create Account button
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Wait for app to load (shows main header with Bealer Agency)
  await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
}

// Helper to login with existing user
async function loginExistingUser(page: Page, userName: string, pin: string = '1234') {
  await page.goto('/');

  // Wait for login screen
  await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });

  // Click on user
  await page.locator(`button:has-text("${userName}")`).click();

  // Enter PIN (4 digit inputs)
  const pinInputs = page.locator('input[type="password"]');
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Wait for app to load
  await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
}

// Helper to check if app is loaded (task input visible)
async function isAppLoaded(page: Page): Promise<boolean> {
  const taskInput = page.locator('input[placeholder="What needs to be done?"]');
  const configError = page.locator('text=Configuration Required');

  try {
    await page.waitForTimeout(2000);
    if (await configError.isVisible()) {
      return false;
    }
    return await taskInput.isVisible();
  } catch {
    return false;
  }
}

// Generate unique test user name
function uniqueUserName() {
  return `T${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

test.describe('PIN Authentication', () => {
  test('should show login screen on first visit', async ({ page }) => {
    await page.goto('/');
    // Should show Bealer Agency title on login screen
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Task Management System')).toBeVisible();
  });

  test('should show Add New User button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("Add New User")')).toBeVisible({ timeout: 10000 });
  });

  test('should allow user registration with name and PIN', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);
    // After login, should see the task input
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible();
  });
});

test.describe('Micro-Rewards (Celebration Effect)', () => {
  test('should show celebration when completing a task via checkbox', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Create a task
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.fill('Celebration test task');
    await page.keyboard.press('Enter');

    // Wait for task to appear and stabilize
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Celebration test task')).toBeVisible({ timeout: 10000 });

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Complete the task by clicking the checkbox - use more specific locator
    const checkbox = page.locator('text=Celebration test task').locator('xpath=ancestor::div[contains(@class, "rounded-xl")]//button[1]');
    await checkbox.click();

    // Should see celebration effect
    await expect(page.locator('text=Task Complete!')).toBeVisible({ timeout: 5000 });
  });

  test('should auto-dismiss celebration after animation', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Create and complete a task
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.fill('Auto dismiss test');
    await page.keyboard.press('Enter');

    // Wait for task to appear
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Auto dismiss test')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Complete the task
    const checkbox = page.locator('text=Auto dismiss test').locator('xpath=ancestor::div[contains(@class, "rounded-xl")]//button[1]');
    await checkbox.click();

    // Celebration should appear
    await expect(page.locator('text=Task Complete!')).toBeVisible({ timeout: 5000 });

    // Wait for auto-dismiss (2 seconds + buffer)
    await expect(page.locator('text=Task Complete!')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Progress Summary', () => {
  test('should show Progress button in header', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Progress button should be visible (has Trophy icon)
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-trophy') })).toBeVisible();
  });

  test('should open Progress Summary modal when clicking Progress button', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Click Progress button
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();

    // Modal should appear with progress stats
    await expect(page.locator('text=Your Progress')).toBeVisible({ timeout: 3000 });
  });

  test('should display streak count in Progress Summary', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Open Progress Summary
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();

    // Should show streak section
    await expect(page.locator('text=Streak')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=days active')).toBeVisible();
  });

  test('should display completion rate in Progress Summary', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Open Progress Summary
    await page.locator('button').filter({ has: page.locator('svg.lucide-trophy') }).click();

    // Should show completion rate
    await expect(page.locator('text=completion rate')).toBeVisible({ timeout: 3000 });
  });

  test('should close Progress Summary when clicking Keep Going button', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

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
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Create a task
    const uniqueTask = `Persistence_${Date.now()}`;
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.fill(uniqueTask);
    await page.keyboard.press('Enter');
    await expect(page.locator(`text=${uniqueTask}`)).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload();

    // Should still be logged in and see task
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${uniqueTask}`)).toBeVisible({ timeout: 5000 });
  });

  test('should persist user session across reloads', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Reload page
    await page.reload();

    // Should still be logged in (see task input, not login screen)
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('User Switcher', () => {
  test('should show user dropdown in header', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Find and click user dropdown (has chevron-down icon)
    const userDropdown = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') }).last();
    await userDropdown.click();

    // Should show dropdown with Log Out option
    await expect(page.locator('text=Log Out')).toBeVisible({ timeout: 3000 });
  });

  test('should logout when clicking Log Out', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Click user dropdown
    const userDropdown = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') }).last();
    await userDropdown.click();

    // Click Log Out
    await page.locator('button:has-text("Log Out")').click();

    // Should return to login screen
    await expect(page.locator('text=Task Management System')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Real-time Connection', () => {
  test('should show Live or Offline status', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Should show either Live or Offline status
    const liveStatus = page.locator('text=Live');
    const offlineStatus = page.locator('text=Offline');

    await expect(liveStatus.or(offlineStatus)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Stats Dashboard', () => {
  test('should show all three stat cards', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    await expect(page.locator('text=Total Tasks')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Overdue')).toBeVisible();
  });

  test('should update Total Tasks when adding a task', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Get initial count
    const totalStat = page.locator('text=Total Tasks').locator('..').locator('p').first();
    const initialCount = parseInt(await totalStat.textContent() || '0');

    // Add a task
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.fill('Stats test task');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Stats test task')).toBeVisible({ timeout: 5000 });

    // Check count increased
    await page.waitForTimeout(500);
    const newCount = parseInt(await totalStat.textContent() || '0');
    expect(newCount).toBe(initialCount + 1);
  });
});

test.describe('View Modes', () => {
  test('should switch to Kanban view', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Click Kanban button (layout-grid icon)
    const kanbanButton = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') });
    await kanbanButton.click();

    // Should see Kanban columns
    await expect(page.locator('h3:has-text("To Do")')).toBeVisible();
    await expect(page.locator('h3:has-text("In Progress")')).toBeVisible();
    await expect(page.locator('h3:has-text("Done")')).toBeVisible();
  });

  test('should switch back to List view', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

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
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Create two tasks
    const input = page.locator('input[placeholder="What needs to be done?"]');

    const activeTask = `Active_${Date.now()}`;
    await input.fill(activeTask);
    await page.keyboard.press('Enter');
    await expect(page.locator(`text=${activeTask}`)).toBeVisible({ timeout: 5000 });

    const taskToComplete = `Complete_${Date.now()}`;
    await input.fill(taskToComplete);
    await page.keyboard.press('Enter');
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
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Create and complete a task
    const input = page.locator('input[placeholder="What needs to be done?"]');
    const taskName = `FilterComplete_${Date.now()}`;
    await input.fill(taskName);
    await page.keyboard.press('Enter');
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
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    const taskName = `Create_${Date.now()}`;
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.fill(taskName);
    await page.keyboard.press('Enter');

    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a task', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    if (!(await isAppLoaded(page))) {
      test.skip();
      return;
    }

    // Create a task
    const taskName = `Delete_${Date.now()}`;
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.fill(taskName);
    await page.keyboard.press('Enter');
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
