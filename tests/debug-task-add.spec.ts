import { test, expect } from '@playwright/test';

function uniqueUserName() {
  return `User${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

test('Debug task creation with console capture', async ({ page }) => {
  const errors: string[] = [];
  const logs: string[] = [];

  // Capture all console messages
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  // Navigate to app
  await page.goto('/');

  // Wait for login screen
  await expect(page.locator('h1').filter({ hasText: 'Bealer Agency' })).toBeVisible({ timeout: 15000 });

  // Register a new user
  const userName = uniqueUserName();
  await page.getByRole('button', { name: 'Add New User' }).click();

  // Fill name
  const nameInput = page.locator('input[type="text"]').first();
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(userName);

  // Enter PIN
  const pinInputs = page.locator('input[type="password"]');
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(String(i + 1));
  }
  for (let i = 4; i < 8; i++) {
    await pinInputs.nth(i).fill(String(i - 3));
  }

  // Create account
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Wait for main app
  const todoInput = page.locator('input[placeholder="What needs to be done?"]');
  await expect(todoInput).toBeVisible({ timeout: 15000 });

  console.log('=== Errors so far ===');
  errors.forEach(e => console.log('ERROR:', e));

  // Clear errors from registration
  errors.length = 0;

  // Now try to add a task
  const taskName = `TestTask_${Date.now()}`;
  console.log('Adding task:', taskName);

  // Click and fill
  await todoInput.click();
  await page.waitForTimeout(300);
  await todoInput.fill(taskName);
  await page.waitForTimeout(300);

  // Verify input value
  const value = await todoInput.inputValue();
  console.log('Input value before submit:', value);
  expect(value).toBe(taskName);

  // Press Enter to submit
  console.log('Pressing Enter...');
  await page.keyboard.press('Enter');

  // Wait and capture any errors
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-task-add.png', fullPage: true });

  // Print all errors
  console.log('\n=== Console Errors After Task Add ===');
  errors.forEach(e => console.log('ERROR:', e));

  console.log('\n=== All Console Logs ===');
  logs.slice(-30).forEach(l => console.log(l));

  // Check if task was added
  const taskVisible = await page.locator(`text=${taskName}`).isVisible();
  console.log('Task visible:', taskVisible);

  // Check stats
  const totalTasksElement = page.locator('p:has-text("Total Tasks")').locator('..').locator('p').first();
  const totalTasksText = await totalTasksElement.textContent();
  console.log('Total tasks stat:', totalTasksText);

  // Check if there are any Supabase-related errors
  const supabaseErrors = errors.filter(e =>
    e.toLowerCase().includes('supabase') ||
    e.toLowerCase().includes('database') ||
    e.toLowerCase().includes('insert') ||
    e.toLowerCase().includes('permission') ||
    e.toLowerCase().includes('policy')
  );

  console.log('\n=== Supabase/DB Errors ===');
  supabaseErrors.forEach(e => console.log('SUPABASE ERROR:', e));

  // The test should pass if we can identify the issue
  expect(taskVisible).toBe(true);
});
