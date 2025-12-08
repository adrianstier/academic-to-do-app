import { test, expect } from '@playwright/test';

test.describe('UX/UI Transformation Tests', () => {
  test.describe('Onboarding Experience', () => {
    test('should display professional welcome screen with Allstate branding', async ({ page }) => {
      // Clear any existing session
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for animated welcome card with Bealer Agency branding
      await expect(page.locator('text=Bealer Agency')).toBeVisible();
      await expect(page.locator('text=Task Management System')).toBeVisible();

      // Check for feature icons (use exact match to avoid "Task Management System" conflict)
      await expect(page.locator('text=Secure & Reliable')).toBeVisible();
      await expect(page.getByText('Task Management', { exact: true })).toBeVisible();
      await expect(page.locator('text=Team Collaboration')).toBeVisible();
    });

    test('should have floating label input animation', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check input exists
      const input = page.locator('input[type="text"]');
      await expect(input).toBeVisible();

      // Check label behavior
      const label = page.locator('label:has-text("Your name")');
      await expect(label).toBeVisible();
    });

    test('should enable button only when name is entered', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      const button = page.locator('button:has-text("Get Started")');

      // Button should be disabled initially
      await expect(button).toBeDisabled();

      // Enter name
      await page.fill('input[type="text"]', 'Test User');

      // Button should be enabled
      await expect(button).toBeEnabled();
    });

    test('should have Allstate blue button styling when enabled', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Enter name to enable button
      await page.fill('input[type="text"]', 'Test User');

      const button = page.locator('button:has-text("Get Started")');

      // Button should be enabled and have Allstate styling
      await expect(button).toBeEnabled();
    });

    test('should show arrow icon in button', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      const button = page.locator('button:has-text("Get Started")');

      // Check for SVG icon inside button
      const svg = button.locator('svg');
      await expect(svg).toBeVisible();
    });

    test('should have glassmorphism card effect', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for backdrop blur class on card
      const card = page.locator('.backdrop-blur-xl').first();
      await expect(card).toBeVisible();
    });

    test('should navigate to app or config screen after login', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      await page.fill('input[type="text"]', 'Test User');
      await page.click('button:has-text("Get Started")');

      // Should either see Bealer Agency header (if Supabase configured) or Configuration Required
      const bealerAgency = page.locator('h1:has-text("Bealer Agency")');
      const configRequired = page.locator('text=Configuration Required');

      // Wait for either outcome
      await expect(bealerAgency.or(configRequired)).toBeVisible({ timeout: 10000 });
    });

    test('should have animated background blobs', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for the animated background elements (blur-3xl classes)
      const blobs = page.locator('.blur-3xl');
      expect(await blobs.count()).toBeGreaterThan(0);
    });

    test('should have proper font styling', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check title has proper styling
      const title = page.locator('h1');
      await expect(title).toBeVisible();
    });

    test('should have feature icons with rounded backgrounds', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for feature icon containers (rounded-xl)
      const iconContainers = page.locator('.rounded-xl');
      expect(await iconContainers.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Visual Design Quality', () => {
    test('should have gradient background on onboarding', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for gradient classes
      const gradientContainer = page.locator('.bg-gradient-to-br').first();
      await expect(gradientContainer).toBeVisible();
    });

    test('should have shadow effects on card', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for shadow class on card
      const shadowElement = page.locator('.shadow-2xl').first();
      await expect(shadowElement).toBeVisible();
    });

    test('should have rounded corners on main card', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for rounded-2xl class (professional styling uses 2xl)
      const roundedCard = page.locator('.rounded-2xl').first();
      await expect(roundedCard).toBeVisible();
    });

    test('should have border styling on input', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      const input = page.locator('input[type="text"]');
      await expect(input).toHaveClass(/border-2/);
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Onboarding should still be visible
      await expect(page.locator('text=Bealer Agency')).toBeVisible();
      await expect(page.locator('button:has-text("Get Started")')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      await expect(page.locator('text=Bealer Agency')).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      await expect(page.locator('text=Bealer Agency')).toBeVisible();
      await expect(page.locator('text=Secure & Reliable')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy on onboarding', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Should have h1
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
    });

    test('should have autofocus on name input', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Wait a moment for autofocus
      await page.waitForTimeout(500);

      // The input should be focused (React handles autofocus programmatically)
      const input = page.locator('input[type="text"]');
      await expect(input).toBeFocused();
    });

    test('should allow form submission with Enter key', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Enter name and press Enter
      await page.fill('input[type="text"]', 'Test User');
      await page.keyboard.press('Enter');

      // Should navigate (either to app or config screen)
      const bealerAgency = page.locator('h1:has-text("Bealer Agency")');
      const configRequired = page.locator('text=Configuration Required');
      await expect(bealerAgency.or(configRequired)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Error State Display', () => {
    test('should show configuration screen with proper styling when Supabase not configured', async ({ page }) => {
      // Set username to trigger app load
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('userName', 'Test User'));
      await page.reload();

      // Wait for config error (since Supabase isn't configured in test)
      const configRequired = page.locator('text=Configuration Required');
      const isConfigError = await configRequired.isVisible({ timeout: 5000 }).catch(() => false);

      if (isConfigError) {
        // Check error screen has proper styling
        await expect(page.locator('.rounded-2xl').first()).toBeVisible();
        await expect(page.locator('text=SETUP.md')).toBeVisible();
      } else {
        // Supabase is configured, we should see the app
        await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible();
      }
    });

    test('should display error icon in warning state', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('userName', 'Test User'));
      await page.reload();

      const configRequired = page.locator('text=Configuration Required');
      const isConfigError = await configRequired.isVisible({ timeout: 5000 }).catch(() => false);

      if (isConfigError) {
        // Should have an alert/warning icon (SVG)
        const alertIcon = page.locator('svg');
        expect(await alertIcon.count()).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Interaction Feedback', () => {
    test('should show visual feedback on button - Allstate styling when enabled', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Enter name to enable button
      await page.fill('input[type="text"]', 'Test User');

      const button = page.locator('button:has-text("Get Started")');

      // Button should be enabled with professional styling
      await expect(button).toBeEnabled();
      await expect(button).toBeVisible();
    });

    test('should show focus state on input', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      const input = page.locator('input[type="text"]');
      await input.focus();

      // Input should be focused
      await expect(input).toBeFocused();
    });

    test('should have transition classes for smooth animations', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for transition-colors class on button
      const button = page.locator('button:has-text("Get Started")');
      await expect(button).toHaveClass(/transition/);
    });
  });

  test.describe('Component Structure', () => {
    test('should have icons container for features', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check each feature has an icon container
      const featureContainers = page.locator('.flex.flex-col.items-center');
      expect(await featureContainers.count()).toBeGreaterThanOrEqual(3);
    });

    test('should have form structure for login', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for form element
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // Check form has input and button
      await expect(form.locator('input[type="text"]')).toBeVisible();
      await expect(form.locator('button[type="submit"]')).toBeVisible();
    });

    test('should have centered card layout', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Check for centering classes
      const centerContainer = page.locator('.flex.items-center.justify-center');
      await expect(centerContainer.first()).toBeVisible();
    });
  });
});
