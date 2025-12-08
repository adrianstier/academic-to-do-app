import { test, expect, Page } from '@playwright/test';

// Helper to generate truly unique user names
function uniqueUserName() {
  return `User${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

// Helper to register a new user - uses more specific locators
async function registerUser(page: Page, userName: string, pin: string = '1234') {
  await page.goto('/');

  // Wait for login screen
  const header = page.locator('h1').filter({ hasText: 'Bealer Agency' });
  await expect(header).toBeVisible({ timeout: 15000 });

  // Click Add New User button
  const addUserBtn = page.getByRole('button', { name: 'Add New User' });
  await addUserBtn.click();

  // Wait for register form - look for name input
  const nameInput = page.locator('input[placeholder="Enter name"]').or(page.locator('input[type="text"]').first());
  await expect(nameInput).toBeVisible({ timeout: 5000 });

  // Fill name
  await nameInput.fill(userName);

  // Enter PIN digits (first 4 inputs)
  const pinInputs = page.locator('input[type="password"]');
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Confirm PIN (inputs 4-7)
  for (let i = 4; i < 8; i++) {
    await pinInputs.nth(i).fill(pin[i - 4]);
  }

  // Click Create Account button (not heading)
  const createBtn = page.getByRole('button', { name: 'Create Account' });
  await createBtn.click();

  // Wait for main app to load
  const todoInput = page.locator('input[placeholder="What needs to be done?"]');
  await expect(todoInput).toBeVisible({ timeout: 15000 });

  return todoInput;
}

test.describe('Core Functionality Tests', () => {
  test('Register and see main app', async ({ page }) => {
    const userName = uniqueUserName();
    await registerUser(page, userName);

    // Verify we see the welcome message
    await expect(page.locator(`text=Welcome, ${userName}`)).toBeVisible();
    console.log('✓ User registered and main app loaded');
  });

  test('Add a task successfully', async ({ page }) => {
    const userName = uniqueUserName();
    const todoInput = await registerUser(page, userName);

    // Create a unique task name
    const taskName = `Task_${Date.now()}`;

    // Focus and fill input
    await todoInput.click();
    await todoInput.fill(taskName);

    // Verify the input has text
    const inputValue = await todoInput.inputValue();
    expect(inputValue).toBe(taskName);

    // Submit with Enter
    await page.keyboard.press('Enter');

    // Wait for task to appear in the list
    await page.waitForTimeout(2000);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/core-add-task.png', fullPage: true });

    // Verify task appears
    const taskLocator = page.locator(`text=${taskName}`);
    await expect(taskLocator).toBeVisible({ timeout: 10000 });
    console.log('✓ Task created and visible');

    // Verify stats updated
    const statsCard = page.locator('text=Total Tasks').locator('..');
    await expect(statsCard).toBeVisible();
  });

  test('Task persists after page reload', async ({ page }) => {
    const userName = uniqueUserName();
    const todoInput = await registerUser(page, userName);

    // Create a unique task
    const taskName = `Persist_${Date.now()}`;
    await todoInput.click();
    await todoInput.fill(taskName);
    await page.keyboard.press('Enter');

    // Wait for task to appear
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    // Wait for Supabase to persist
    await page.waitForTimeout(3000);

    // Reload page
    await page.reload();

    // Wait for app to load again
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 15000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/core-persist-reload.png', fullPage: true });

    // Verify task still exists
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });
    console.log('✓ Task persisted after reload');
  });

  test('User switcher modal displays correctly', async ({ page }) => {
    // Create first user
    const user1 = uniqueUserName();
    await registerUser(page, user1);

    // Sign out
    const userBtn = page.locator('button').filter({ has: page.locator(`text=${user1.substring(0, 2).toUpperCase()}`) }).first();
    await userBtn.click();
    await page.waitForTimeout(500);

    const signOutBtn = page.locator('button').filter({ hasText: 'Sign Out' });
    await signOutBtn.click();

    // Wait for login screen
    await expect(page.locator('h1').filter({ hasText: 'Bealer Agency' })).toBeVisible({ timeout: 15000 });

    // Create second user
    const user2 = uniqueUserName();
    await registerUser(page, user2);

    // Open user dropdown
    const userBtn2 = page.locator('button').filter({ has: page.locator(`text=${user2.substring(0, 2).toUpperCase()}`) }).first();
    await userBtn2.click();
    await page.waitForTimeout(500);

    // Take screenshot of dropdown
    await page.screenshot({ path: 'test-results/core-user-dropdown.png', fullPage: true });

    // Click on user1 to trigger PIN modal
    const user1Btn = page.locator('button').filter({ hasText: user1 }).first();
    await user1Btn.click();
    await page.waitForTimeout(500);

    // Take screenshot of PIN modal
    await page.screenshot({ path: 'test-results/core-pin-modal.png', fullPage: true });

    // Verify PIN modal is visible
    await expect(page.locator('text=Enter PIN to switch')).toBeVisible({ timeout: 5000 });
    console.log('✓ PIN modal displayed correctly');

    // Verify PIN inputs are visible (4 inputs)
    const pinInputs = page.locator('input[type="password"]');
    await expect(pinInputs.first()).toBeVisible();

    const count = await pinInputs.count();
    expect(count).toBe(4);

    // Enter correct PIN and switch
    for (let i = 0; i < 4; i++) {
      await pinInputs.nth(i).fill(String(i + 1));
    }

    // Wait for switch
    await page.waitForTimeout(2000);

    // Take screenshot after switch
    await page.screenshot({ path: 'test-results/core-after-switch.png', fullPage: true });

    // Verify we switched to user1
    await expect(page.locator(`text=Welcome, ${user1}`)).toBeVisible({ timeout: 10000 });
    console.log('✓ Successfully switched users');
  });
});
