import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate, createTask } from './fixtures/helpers';

async function loginAsExistingUser(page: Page) {
  await setupAndNavigate(page);
}

test.describe('Content Import Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExistingUser(page);
  });

  test('should show Import button when task is expanded', async ({ page }) => {
    // Add a task
    const taskText = `Q1 Planning ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Should show the "Import" button (with Mail icon) in the subtasks section
    await expect(page.locator('button:has-text("Import")')).toBeVisible({ timeout: 3000 });
  });

  test('should open import modal when clicking Import button', async ({ page }) => {
    // Add a task
    const taskText = `Project Review ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the Import button
    await page.locator('button:has-text("Import")').click();

    // Modal should appear with title
    await expect(page.locator('text=Import as Subtasks')).toBeVisible({ timeout: 3000 });

    // Should have Paste Email and Upload Audio options (using first() to handle multiple matches)
    await expect(page.locator('p.font-medium:has-text("Paste Email")')).toBeVisible();
    await expect(page.locator('p.font-medium:has-text("Upload Audio")')).toBeVisible();
  });

  test('should close modal when clicking X button', async ({ page }) => {
    // Add a task
    const taskText = `Meeting Notes ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task to appear and expand
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });
    await page.locator(`text=${taskText}`).click();

    // Open the modal
    await page.locator('button:has-text("Import")').click();
    await expect(page.locator('text=Import as Subtasks')).toBeVisible({ timeout: 3000 });

    // Click close button (X icon in the header)
    await page.locator('button:has(svg.lucide-x)').click();

    // Modal should close
    await expect(page.locator('text=Import as Subtasks')).not.toBeVisible({ timeout: 3000 });
  });

  test('should switch between Email and Voicemail modes', async ({ page }) => {
    // Add a task
    const taskText = `Client Follow-up ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task and expand
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });
    await page.locator(`text=${taskText}`).click();

    // Open the modal
    await page.locator('button:has-text("Import")').click();
    await expect(page.locator('text=Import as Subtasks')).toBeVisible({ timeout: 3000 });

    // Mode selection should be visible by default
    await expect(page.locator('p.font-medium:has-text("Paste Email")')).toBeVisible();
    await expect(page.locator('p.font-medium:has-text("Upload Audio")')).toBeVisible();

    // Click Paste Email button to enter email mode
    await page.locator('p.font-medium:has-text("Paste Email")').click();

    // Email textarea should be visible
    await expect(page.locator('textarea[placeholder*="Paste"]')).toBeVisible();

    // Click back button to return to mode selection
    await page.locator('text=← Back').click();

    // Mode selection should be visible again
    await expect(page.locator('p.font-medium:has-text("Paste Email")')).toBeVisible();

    // Click Upload Audio to enter voicemail mode
    await page.locator('p.font-medium:has-text("Upload Audio")').click();

    // File upload area should be visible
    await expect(page.locator('text=Click to upload audio file')).toBeVisible();
  });

  test('should parse email content and show extracted subtasks', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Q1 Product Launch ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task and expand
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });
    await page.locator(`text=${taskText}`).click();

    // Open the modal
    await page.locator('button:has-text("Import")').click();
    await expect(page.locator('text=Import as Subtasks')).toBeVisible({ timeout: 3000 });

    // Click Paste Email to enter email mode
    await page.locator('p.font-medium:has-text("Paste Email")').click();

    // Paste a test email
    const testEmail = `Hi Team,

Following up on our Monday meeting about the Q1 product launch.

First, the marketing brochures need to be finalized by January 15th.
Also, the social media calendar needs to be drafted.
Don't forget to complete the API documentation.
We also need to fix the authentication bug (ticket #4521).

Thanks,
Michael`;

    await page.locator('textarea[placeholder*="Paste"]').fill(testEmail);

    // Click Extract Subtasks button
    await page.locator('button:has-text("Extract Subtasks")').click();

    // Wait for loading
    await expect(page.locator('text=Extracting action items')).toBeVisible({ timeout: 5000 });

    // Wait for subtasks to appear (should see "X subtasks found" text)
    await expect(page.locator('text=subtasks found')).toBeVisible({ timeout: 30000 });

    // Should have extracted subtasks with selection buttons (look for the "Add X Subtasks" button)
    await expect(page.locator('button:has-text("Add"):has-text("Subtasks")')).toBeVisible();
  });

  test('should add selected subtasks to task', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Team Meeting ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task and expand
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });
    await page.locator(`text=${taskText}`).click();

    // Open the modal
    await page.locator('button:has-text("Import")').click();
    await expect(page.locator('text=Import as Subtasks')).toBeVisible({ timeout: 3000 });

    // Click Paste Email to enter email mode
    await page.locator('p.font-medium:has-text("Paste Email")').click();

    // Paste a simple email
    const testEmail = `Please review the quarterly report by Friday. Also, schedule the team sync meeting for next week.`;

    await page.locator('textarea[placeholder*="Paste"]').fill(testEmail);

    // Click Extract Subtasks
    await page.locator('button:has-text("Extract Subtasks")').click();

    // Wait for subtasks to appear (should see "X subtasks found")
    await expect(page.locator('text=subtasks found')).toBeVisible({ timeout: 30000 });

    // All subtasks should be checked by default - click "Add X Subtasks" button (specific to the modal)
    await page.locator('button:has-text("Add"):has-text("Subtask")').click();

    // Modal should close
    await expect(page.locator('text=Import as Subtasks')).not.toBeVisible({ timeout: 3000 });

    // Task should now show subtask indicator (look for the specific task's subtask badge)
    // The subtask indicator shows "X/Y" format like "0/2"
    const taskRow = page.locator(`text=${taskText}`).locator('..').locator('..');
    await expect(taskRow.locator('button:has-text("/")')).toBeVisible({ timeout: 5000 });
  });

  test('should show Import button even when task has existing subtasks', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task
    const taskText = `Budget Review ${Date.now()}`;
    await createTask(page, taskText);

    // Wait for task and expand
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });
    await page.locator(`text=${taskText}`).click();

    // Add a manual subtask first
    const subtaskInput = page.locator('input[placeholder*="Add a subtask"]');
    if (await subtaskInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subtaskInput.fill('Manual subtask');
      await subtaskInput.press('Enter');
      await page.waitForTimeout(500);
    }

    // Import button should still be visible (can add more)
    await expect(page.locator('button:has-text("Import")')).toBeVisible();
  });
});

test.describe('Content Import API', () => {
  test('should return proper structure from parse-content-to-subtasks API', async ({ request }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    const response = await request.post('/api/ai/parse-content-to-subtasks', {
      data: {
        content: 'Please finalize the budget by Friday. Also review the contract draft and send it to legal. Make sure to update the project timeline.',
        contentType: 'email',
        parentTaskText: 'Q1 Planning'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.subtasks).toBeDefined();
    expect(Array.isArray(data.subtasks)).toBe(true);
    expect(data.subtasks.length).toBeGreaterThanOrEqual(2);

    // Each subtask should have required fields
    for (const subtask of data.subtasks) {
      expect(subtask.text).toBeDefined();
      expect(typeof subtask.text).toBe('string');
      expect(subtask.priority).toBeDefined();
      expect(['low', 'medium', 'high', 'urgent']).toContain(subtask.priority);
    }
  });

  test('should handle missing content gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/parse-content-to-subtasks', {
      data: {}
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('should handle empty content gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/parse-content-to-subtasks', {
      data: {
        content: '',
        contentType: 'email'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should handle content with no action items', async ({ request }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    const response = await request.post('/api/ai/parse-content-to-subtasks', {
      data: {
        content: 'Thanks for the update. Have a great day!',
        contentType: 'email',
        parentTaskText: 'Random email'
      }
    });

    // Should still return success but potentially with fewer subtasks
    const data = await response.json();
    expect(data.success).toBeDefined();
  });
});
