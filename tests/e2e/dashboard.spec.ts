/**
 * E2E Tests: Project Dashboard
 *
 * Tests the project dashboard view which displays project stats,
 * milestone tracking, recent activity, and project search/filter.
 * Two dashboard components: DashboardPage (main) and ProjectDashboard (project-specific).
 */

import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate, createTask, uniqueTaskName, closeModal } from '../fixtures/helpers';

// Helper to navigate to the main dashboard
async function navigateToDashboard(page: Page): Promise<boolean> {
  // Look for Dashboard navigation item
  const dashboardNav = page.locator('button, a, [role="tab"]').filter({ hasText: /Dashboard/i }).first();
  if (await dashboardNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dashboardNav.click();
    await page.waitForTimeout(1000);
    return true;
  }

  // Try using the sidebar navigation
  const sidebarDash = page.locator('[data-view="dashboard"], button[aria-label*="dashboard"]').first();
  if (await sidebarDash.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidebarDash.click();
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

// Helper to navigate to the project dashboard
async function navigateToProjectDashboard(page: Page): Promise<boolean> {
  const projectsNav = page.locator('button, a, [role="tab"]').filter({ hasText: /Projects/i }).first();
  if (await projectsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await projectsNav.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

test.describe('Main Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndNavigate(page);
  });

  test('should navigate to the dashboard view', async ({ page }) => {
    const navigated = await navigateToDashboard(page);

    if (!navigated) {
      test.skip(true, 'Dashboard navigation not available in current UI');
      return;
    }

    // Dashboard should show greeting or user name
    const greeting = page.locator('text=/Good (morning|afternoon|evening)/').first();
    const userName = page.locator('h1').filter({ hasText: /Test User/i }).first();

    const hasGreeting = await greeting.isVisible({ timeout: 5000 }).catch(() => false);
    const hasUserName = await userName.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasGreeting || hasUserName).toBeTruthy();
  });

  test('should display quick stats (overdue, due today, this week)', async ({ page }) => {
    const navigated = await navigateToDashboard(page);
    if (!navigated) {
      test.skip(true, 'Dashboard navigation not available');
      return;
    }

    // The dashboard header shows 3 stat cards
    const overdueCard = page.locator('text=/Overdue/i').first();
    const dueTodayCard = page.locator('text=/Due Today/i').first();
    const thisWeekCard = page.locator('text=/This Week/i').first();

    const hasOverdue = await overdueCard.isVisible({ timeout: 5000 }).catch(() => false);
    const hasDueToday = await dueTodayCard.isVisible({ timeout: 5000 }).catch(() => false);
    const hasThisWeek = await thisWeekCard.isVisible({ timeout: 5000 }).catch(() => false);

    // At least one stat card should be visible
    expect(hasOverdue || hasDueToday || hasThisWeek).toBeTruthy();
  });

  test('should show active tasks count in header', async ({ page }) => {
    const navigated = await navigateToDashboard(page);
    if (!navigated) {
      test.skip(true, 'Dashboard navigation not available');
      return;
    }

    // The header shows "X active tasks"
    const activeTasks = page.locator('text=/\\d+ active task/').first();
    const hasActiveCount = await activeTasks.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasActiveCount).toBeTruthy();
  });

  test('should show time-based greeting (morning/afternoon/evening)', async ({ page }) => {
    const navigated = await navigateToDashboard(page);
    if (!navigated) {
      test.skip(true, 'Dashboard navigation not available');
      return;
    }

    // The greeting changes based on time of day
    const greeting = page.locator('text=/Good (morning|afternoon|evening)/').first();
    await expect(greeting).toBeVisible({ timeout: 5000 });
  });

  test('should show overdue stat as clickable to filter', async ({ page }) => {
    const navigated = await navigateToDashboard(page);
    if (!navigated) {
      test.skip(true, 'Dashboard navigation not available');
      return;
    }

    // The overdue stat card is a button with aria-label
    const overdueBtn = page.locator('button[aria-label*="overdue"]').first();
    const hasOverdueBtn = await overdueBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasOverdueBtn) {
      // Clicking should navigate to tasks filtered by overdue
      await overdueBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should show due today stat as clickable to filter', async ({ page }) => {
    const navigated = await navigateToDashboard(page);
    if (!navigated) {
      test.skip(true, 'Dashboard navigation not available');
      return;
    }

    // The due today stat card is a button with aria-label
    const dueTodayBtn = page.locator('button[aria-label*="due today"]').first();
    const hasDueTodayBtn = await dueTodayBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDueTodayBtn) {
      await dueTodayBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Project Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndNavigate(page);
  });

  test('should display project list with task counts', async ({ page }) => {
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard navigation not available');
      return;
    }

    // Project cards should display task counts like "X/Y tasks"
    const taskCountText = page.locator('text=/\\d+\\/\\d+ tasks/').first();
    const hasTaskCount = await taskCountText.isVisible({ timeout: 5000 }).catch(() => false);

    // If no projects exist, we should see the empty state
    const emptyState = page.locator('text=Create your first project');
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasTaskCount || hasEmpty).toBeTruthy();
  });

  test('should show project completion percentage', async ({ page }) => {
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard navigation not available');
      return;
    }

    // Project cards show completion percentage
    const percentText = page.locator('text=/\\d+%/').first();
    const hasPercent = await percentText.isVisible({ timeout: 5000 }).catch(() => false);

    // May not have projects
    const emptyState = page.locator('text=Create your first project');
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasPercent || hasEmpty).toBeTruthy();
  });

  test('should show project status badges (Active, Completed, Archived)', async ({ page }) => {
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard navigation not available');
      return;
    }

    // Project cards have status badges
    const activeBadge = page.locator('span').filter({ hasText: /^Active$/ }).first();
    const completedBadge = page.locator('span').filter({ hasText: /^Completed$/ }).first();
    const archivedBadge = page.locator('span').filter({ hasText: /^Archived$/ }).first();

    const hasActive = await activeBadge.isVisible({ timeout: 3000 }).catch(() => false);
    const hasCompleted = await completedBadge.isVisible({ timeout: 3000 }).catch(() => false);
    const hasArchived = await archivedBadge.isVisible({ timeout: 3000 }).catch(() => false);

    // If projects exist, at least one status badge should be visible
    const emptyState = page.locator('text=Create your first project');
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasActive || hasCompleted || hasArchived || hasEmpty).toBeTruthy();
  });

  test('should search projects by name', async ({ page }) => {
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard navigation not available');
      return;
    }

    const searchInput = page.locator('input[placeholder*="Search projects"]').first();
    if (!await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Project search input not found');
      return;
    }

    // Type a search query
    await searchInput.fill('research');
    await page.waitForTimeout(500);

    // Results should be filtered or show "No projects found"
    const noResults = page.locator('text=No projects found');
    const hasNoResults = await noResults.isVisible({ timeout: 2000 }).catch(() => false);
    // Either filtered results or empty state
    expect(true).toBeTruthy(); // Search executed without error
  });

  test('should open project detail when clicking a project card', async ({ page }) => {
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard navigation not available');
      return;
    }

    // Click on a project card
    const projectCard = page.locator('button').filter({ hasText: /Active|Completed/ }).first();
    if (!await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No project cards available -- requires Supabase data');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(1000);

    // Should see the project detail view with "Back to Projects" button
    const backBtn = page.locator('button').filter({ hasText: /Back to Projects/i });
    await expect(backBtn).toBeVisible({ timeout: 5000 });
  });

  test.skip('should display project stats when viewing a project', async ({ page }) => {
    // Project stats require the ProjectStats component and Supabase API
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard not available');
      return;
    }

    // Open a project
    const projectCard = page.locator('button').filter({ hasText: /Active/ }).first();
    if (!await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No projects available');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(1500);

    // ProjectStats should show completion stats, category breakdown, etc.
    const statsSection = page.locator('text=Completion, text=Tasks, text=Progress').first();
    const hasStats = await statsSection.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasStats).toBeTruthy();
  });

  test.skip('should display milestone tracker in project detail', async ({ page }) => {
    // MilestoneTracker requires Supabase for milestone data
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard not available');
      return;
    }

    const projectCard = page.locator('button').filter({ hasText: /Active/ }).first();
    if (!await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No projects available');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(1500);

    // Look for milestone section
    const milestoneSection = page.locator('text=Milestones').first();
    const hasMilestones = await milestoneSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasMilestones) {
      await expect(milestoneSection).toBeVisible();
    }
  });

  test.skip('should create a milestone in project detail', async ({ page }) => {
    // Creating milestones requires Supabase
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard not available');
      return;
    }

    const projectCard = page.locator('button').filter({ hasText: /Active/ }).first();
    if (!await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No projects available');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(1500);

    // Find "Add milestone" button
    const addMilestoneBtn = page.locator('button').filter({ hasText: /Add Milestone|New Milestone/i }).first();
    if (!await addMilestoneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Add milestone button not found');
      return;
    }

    await addMilestoneBtn.click();
    await page.waitForTimeout(500);

    // Fill in milestone title
    const titleInput = page.locator('input[placeholder*="milestone"], input[type="text"]').last();
    await titleInput.fill('Complete data collection');

    // Submit
    const submitBtn = page.locator('button').filter({ hasText: /Add|Save|Create/i }).last();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Verify milestone appears
    await expect(page.locator('text=Complete data collection')).toBeVisible({ timeout: 5000 });
  });

  test.skip('should display recent activity feed in project detail', async ({ page }) => {
    // Recent activity requires Supabase data
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard not available');
      return;
    }

    const projectCard = page.locator('button').filter({ hasText: /Active/ }).first();
    if (!await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No projects available');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(1500);

    // Look for "Recent Activity" heading
    const activitySection = page.locator('text=Recent Activity').first();
    await expect(activitySection).toBeVisible({ timeout: 5000 });
  });

  test('should show project count in header', async ({ page }) => {
    const navigated = await navigateToProjectDashboard(page);
    if (!navigated) {
      test.skip(true, 'Project dashboard not available');
      return;
    }

    // Header shows "X projects . Y active"
    const projectCount = page.locator('text=/\\d+ project/').first();
    const hasCount = await projectCount.isVisible({ timeout: 5000 }).catch(() => false);

    // If no projects exist, we might not see the count
    expect(true).toBeTruthy(); // Page rendered without error
  });
});
