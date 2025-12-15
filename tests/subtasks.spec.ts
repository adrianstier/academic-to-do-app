import { test, expect, Page } from '@playwright/test';

// Helper to register a new user and login
async function registerAndLogin(page: Page, userName: string = 'Test User', pin: string = '1234') {
  await page.goto('/');

  // Wait for login screen to load (shows "Bealer Agency" and "Task Management")
  await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Task Management')).toBeVisible({ timeout: 5000 });

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
  await expect(page.locator('textarea[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
}

// Generate unique test user name
function uniqueUserName() {
  return `T${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

test.describe('Subtask Feature', () => {
  test.beforeEach(async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);
  });

  test('should show break into subtasks button when task is expanded', async ({ page }) => {
    // Add a task
    const taskText = `Build website ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Should show the "Break into subtasks" button in expanded view
    await expect(page.locator('button:has-text("Break into subtasks")')).toBeVisible({ timeout: 3000 });
  });

  test('should create subtasks when clicking break into subtasks button', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task that can be broken down
    const taskText = `Organize company retreat ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the break into subtasks button
    await page.locator('button:has-text("Break into subtasks")').click();

    // Wait for loading state
    await expect(page.locator('text=Breaking down...')).toBeVisible({ timeout: 3000 });

    // Wait for subtasks to appear (progress bar)
    await expect(page.locator('text=Progress')).toBeVisible({ timeout: 30000 });

    // Should have subtask items visible
    const subtaskCheckboxes = page.locator('.bg-indigo-50\\/50 button[class*="rounded"]');
    await expect(subtaskCheckboxes.first()).toBeVisible({ timeout: 5000 });
  });

  test('should hide break into subtasks button after subtasks are created', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Plan quarterly review ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the break into subtasks button
    await page.locator('button:has-text("Break into subtasks")').click();

    // Wait for subtasks to be created
    await expect(page.locator('text=Progress')).toBeVisible({ timeout: 30000 });

    // The "Break into subtasks" button should no longer be visible
    await expect(page.locator('button:has-text("Break into subtasks")')).not.toBeVisible();
  });

  test('should show subtask indicator badge on task', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Launch marketing campaign ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the break into subtasks button
    await page.locator('button:has-text("Break into subtasks")').click();

    // Wait for subtasks to be created
    await expect(page.locator('text=Progress')).toBeVisible({ timeout: 30000 });

    // Should show subtask count indicator (e.g., "0/3")
    await expect(page.locator('.bg-indigo-100').first()).toBeVisible();
  });

  test('should allow manually adding subtasks', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Complete project ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the break into subtasks button to create initial subtasks
    await page.locator('button:has-text("Break into subtasks")').click();

    // Wait for subtasks panel to appear
    await expect(page.locator('input[placeholder="Add a subtask..."]')).toBeVisible({ timeout: 30000 });

    // Add a manual subtask
    const manualSubtask = 'Custom subtask item';
    await page.locator('input[placeholder="Add a subtask..."]').fill(manualSubtask);
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');

    // Should see the new subtask
    await expect(page.locator(`text=${manualSubtask}`)).toBeVisible({ timeout: 3000 });
  });

  test('should toggle subtask completion', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Review documents ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the break into subtasks button
    await page.locator('button:has-text("Break into subtasks")').click();

    // Wait for subtasks to appear
    await expect(page.locator('text=Progress')).toBeVisible({ timeout: 30000 });

    // Wait for progress bar to show 0% (using exact match)
    const progressText = page.locator('.bg-indigo-50\\/50 span:text-is("0%")');
    await expect(progressText).toBeVisible({ timeout: 5000 });

    // Click first subtask checkbox to complete it
    const firstSubtaskCheckbox = page.locator('.bg-indigo-50\\/50 button[class*="rounded border-2"]').first();
    await firstSubtaskCheckbox.click();

    // Wait for progress to update
    await page.waitForTimeout(500);

    // Progress should no longer be 0% (should be higher)
    await expect(progressText).not.toBeVisible({ timeout: 3000 });
  });

  test('should delete subtask', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Prepare presentation ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the break into subtasks button
    await page.locator('button:has-text("Break into subtasks")').click();

    // Wait for subtasks to appear
    await expect(page.locator('text=Progress')).toBeVisible({ timeout: 30000 });

    // Get initial subtask count from the indicator
    const initialCount = await page.locator('.bg-indigo-50\\/50 .space-y-2 > div').count();

    // Click delete button on first subtask
    const deleteButton = page.locator('.bg-indigo-50\\/50 button[class*="hover:text-red"]').first();
    await deleteButton.click();

    // Wait for subtask to be removed
    await page.waitForTimeout(500);

    // Count should be reduced by 1
    const newCount = await page.locator('.bg-indigo-50\\/50 .space-y-2 > div').count();
    expect(newCount).toBe(initialCount - 1);
  });
});

test.describe('Subtask API', () => {
  test('should return proper structure from breakdown-task API', async ({ request }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    const response = await request.post('/api/ai/breakdown-task', {
      data: {
        taskText: 'Organize team building event',
        priority: 'high'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.subtasks).toBeDefined();
    expect(Array.isArray(data.subtasks)).toBe(true);
    expect(data.subtasks.length).toBeGreaterThanOrEqual(2);
    expect(data.subtasks.length).toBeLessThanOrEqual(6);

    // Each subtask should have required fields
    for (const subtask of data.subtasks) {
      expect(subtask.text).toBeDefined();
      expect(typeof subtask.text).toBe('string');
      expect(subtask.priority).toBeDefined();
      expect(['low', 'medium', 'high', 'urgent']).toContain(subtask.priority);
    }
  });

  test('should handle missing taskText gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/breakdown-task', {
      data: {}
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('should handle empty taskText gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/breakdown-task', {
      data: {
        taskText: ''
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
