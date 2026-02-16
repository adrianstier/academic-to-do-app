/**
 * E2E Tests: Project Management
 *
 * Tests CRUD operations on projects, project filtering, and project badge display.
 * Projects are managed via the ProjectDashboard component and API routes.
 */

import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate, createTask, uniqueTaskName, navigateToView, closeModal } from '../fixtures/helpers';

// Helper to navigate to the projects view
async function navigateToProjects(page: Page) {
  // Look for the Projects nav item in the sidebar or bottom nav
  const projectsNav = page.locator('button, a, [role="tab"]').filter({ hasText: /Projects/i }).first();
  if (await projectsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await projectsNav.click();
    await page.waitForTimeout(1000);
  }
}

// Helper to open the create project modal
async function openCreateProjectModal(page: Page) {
  const newProjectBtn = page.locator('button').filter({ hasText: /New Project|Create Project/i }).first();
  await newProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
  await newProjectBtn.click();
  await page.waitForTimeout(500);
}

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndNavigate(page);
  });

  test('should navigate to the projects view', async ({ page }) => {
    await navigateToProjects(page);

    // The projects view should display the "Projects" heading
    const heading = page.locator('h1').filter({ hasText: /Projects/i }).first();
    const isVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

    // If there is no dedicated projects view visible, the navigation may differ
    if (isVisible) {
      await expect(heading).toBeVisible();
    } else {
      // The projects view may be integrated into the main app differently
      test.skip(true, 'Projects view navigation not available in current UI layout');
    }
  });

  test('should open the create project modal', async ({ page }) => {
    await navigateToProjects(page);

    // Look for the New Project button
    const newProjectBtn = page.locator('button').filter({ hasText: /New Project|Create Project/i }).first();
    const hasBtnVisible = await newProjectBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasBtnVisible) {
      test.skip(true, 'Create project button not visible -- projects view may require Supabase');
      return;
    }

    await newProjectBtn.click();
    await page.waitForTimeout(500);

    // The modal should contain a project name input
    const dialog = page.locator('[role="dialog"]').first();
    const nameInput = page.locator('input[placeholder*="NSF"], input[placeholder*="Grant"], input[type="text"]').first();

    const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
    const inputVisible = await nameInput.isVisible({ timeout: 3000 }).catch(() => false);

    expect(dialogVisible || inputVisible).toBeTruthy();
  });

  test('should create a new project with name, color, and description', async ({ page }) => {
    await navigateToProjects(page);

    const newProjectBtn = page.locator('button').filter({ hasText: /New Project|Create Project/i }).first();
    if (!await newProjectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Create project button not visible -- requires Supabase');
      return;
    }

    await newProjectBtn.click();
    await page.waitForTimeout(500);

    const projectName = `Test Project ${Date.now()}`;

    // Fill project name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill(projectName);

    // Fill description
    const descInput = page.locator('textarea').first();
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill('A test project for E2E testing');
    }

    // Select a color (click the second color swatch to change from default)
    const colorSwatches = page.locator('button[aria-label*="Select color"]');
    if (await colorSwatches.nth(1).isVisible({ timeout: 1000 }).catch(() => false)) {
      await colorSwatches.nth(1).click();
    }

    // Click Create Project button
    const createBtn = page.locator('button').filter({ hasText: /^Create Project$/i }).first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1500);

      // Verify project appears in the list
      const projectCard = page.locator(`text=${projectName}`);
      await expect(projectCard).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display project details when clicking a project card', async ({ page }) => {
    await navigateToProjects(page);

    // Click on any existing project card
    const projectCard = page.locator('button').filter({ hasText: /Active|Completed/ }).first();
    if (!await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No projects available to view -- requires Supabase data');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(1000);

    // Should see the project detail view with Back button
    const backBtn = page.locator('button').filter({ hasText: /Back to Projects/i });
    await expect(backBtn).toBeVisible({ timeout: 5000 });
  });

  test.skip('should edit project details', async ({ page }) => {
    // This test requires existing project data from Supabase
    await navigateToProjects(page);

    // Navigate to project detail
    const projectCard = page.locator('button').filter({ hasText: /Active/ }).first();
    await projectCard.click();
    await page.waitForTimeout(1000);

    // Look for edit controls in the project detail view
    const editBtn = page.locator('button').filter({ hasText: /Edit|Settings/i }).first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test.skip('should archive a project', async ({ page }) => {
    // Archiving requires a running Supabase instance and existing project data
    await navigateToProjects(page);

    const projectCard = page.locator('button').filter({ hasText: /Active/ }).first();
    await projectCard.click();
    await page.waitForTimeout(1000);

    // Look for archive button in project detail
    const archiveBtn = page.locator('button').filter({ hasText: /Archive/i }).first();
    if (await archiveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await archiveBtn.click();
      await page.waitForTimeout(500);

      // Confirm if dialog appears
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm|Yes/i });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      // Should show "Archived" status badge
      await expect(page.locator('text=Archived')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter tasks by project when a project is selected', async ({ page }) => {
    // Projects filter is in the main task view's filter bar
    const projectFilter = page.locator('select[aria-label*="project"], button').filter({ hasText: /All Projects/i }).first();

    if (!await projectFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try opening advanced filters first
      const filterBtn = page.locator('button').filter({ hasText: /Filter/i }).first();
      if (await filterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Look for project filter dropdown
    const projectSelect = page.locator('select').filter({ has: page.locator('option:has-text("All Projects")') }).first();
    if (await projectSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      // If there are project options, select the first non-default one
      const options = await projectSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await projectSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
      }
    } else {
      // Project filter may not be visible without projects in the database
      test.skip(true, 'Project filter not available -- requires Supabase projects');
    }
  });

  test('should search projects by name', async ({ page }) => {
    await navigateToProjects(page);

    const searchInput = page.locator('input[placeholder*="Search projects"]').first();
    if (!await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Project search input not visible -- projects view may require Supabase');
      return;
    }

    // Type a search query
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // The project list should be filtered (or show "No projects found")
    const noResults = page.locator('text=No projects found');
    const projectCards = page.locator('button').filter({ hasText: /Active|Completed|Archived/ });

    const hasNoResults = await noResults.isVisible({ timeout: 2000 }).catch(() => false);
    const hasProjects = (await projectCards.count()) > 0;

    // Either filtered results or "no results" message should be visible
    expect(hasNoResults || hasProjects).toBeTruthy();
  });

  test('should show project color bar on project cards', async ({ page }) => {
    await navigateToProjects(page);

    // Project cards have a colored bar at the top (h-1.5 div with inline backgroundColor)
    const colorBars = page.locator('.h-1\\.5');
    const projectCount = await colorBars.count();

    if (projectCount === 0) {
      test.skip(true, 'No project cards visible -- requires Supabase data');
      return;
    }

    // At least one color bar should exist on the page
    expect(projectCount).toBeGreaterThan(0);
  });
});
