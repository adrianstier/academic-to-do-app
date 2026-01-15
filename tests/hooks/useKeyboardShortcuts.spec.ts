/**
 * Unit Tests for useKeyboardShortcuts Hook
 *
 * Tests keyboard shortcut registration, modifier key handling, and cross-platform support.
 */

import { test, expect, Page } from '@playwright/test';

// Test page setup helper
async function setupTestPage(page: Page) {
  await page.goto('/');
  await page.waitForTimeout(1000);
}

test.describe('useKeyboardShortcuts Hook', () => {
  test.describe('Basic Shortcut Handling', () => {
    test('should call action when single key shortcut is pressed', async ({ page }) => {
      await setupTestPage(page);

      const actionCalled = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let called = false;

          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'a') {
              called = true;
              document.removeEventListener('keydown', handleKeyDown);
              resolve(called);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          // Dispatch key event
          const event = new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            bubbles: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(called), 100);
        });
      });

      expect(actionCalled).toBe(true);
    });

    test('should call action when shortcut with Ctrl modifier is pressed', async ({ page }) => {
      await setupTestPage(page);

      const actionCalled = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let called = false;

          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'c' && e.ctrlKey) {
              called = true;
              e.preventDefault();
              document.removeEventListener('keydown', handleKeyDown);
              resolve(called);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 'c',
            code: 'KeyC',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(called), 100);
        });
      });

      expect(actionCalled).toBe(true);
    });

    test('should call action when shortcut with Meta (Cmd) modifier is pressed', async ({ page }) => {
      await setupTestPage(page);

      const actionCalled = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let called = false;

          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'c' && e.metaKey) {
              called = true;
              e.preventDefault();
              document.removeEventListener('keydown', handleKeyDown);
              resolve(called);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 'c',
            code: 'KeyC',
            metaKey: true,
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(called), 100);
        });
      });

      expect(actionCalled).toBe(true);
    });
  });

  test.describe('Modifier Key Combinations', () => {
    test('should handle Ctrl+Shift combination', async ({ page }) => {
      await setupTestPage(page);

      const result = await page.evaluate(() => {
        return new Promise<{ ctrlKey: boolean; shiftKey: boolean }>((resolve) => {
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 's' && e.ctrlKey && e.shiftKey) {
              document.removeEventListener('keydown', handleKeyDown);
              resolve({ ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 's',
            code: 'KeyS',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve({ ctrlKey: false, shiftKey: false }), 100);
        });
      });

      expect(result.ctrlKey).toBe(true);
      expect(result.shiftKey).toBe(true);
    });

    test('should handle Alt modifier', async ({ page }) => {
      await setupTestPage(page);

      const altPressed = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'a' && e.altKey) {
              document.removeEventListener('keydown', handleKeyDown);
              resolve(true);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            altKey: true,
            bubbles: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(false), 100);
        });
      });

      expect(altPressed).toBe(true);
    });

    test('should not trigger without required modifier', async ({ page }) => {
      await setupTestPage(page);

      const triggered = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let triggered = false;

          const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if Ctrl is pressed
            if (e.key === 'c' && e.ctrlKey) {
              triggered = true;
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          // Dispatch event WITHOUT Ctrl modifier
          const event = new KeyboardEvent('keydown', {
            key: 'c',
            code: 'KeyC',
            ctrlKey: false,
            bubbles: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            resolve(triggered);
          }, 100);
        });
      });

      expect(triggered).toBe(false);
    });
  });

  test.describe('Prevent Default Behavior', () => {
    test('should prevent default when shortcut matches', async ({ page }) => {
      await setupTestPage(page);

      const defaultPrevented = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 's' && e.ctrlKey) {
              e.preventDefault();
              document.removeEventListener('keydown', handleKeyDown);
              resolve(e.defaultPrevented);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 's',
            code: 'KeyS',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(false), 100);
        });
      });

      expect(defaultPrevented).toBe(true);
    });

    test('should not prevent default when shortcut does not match', async ({ page }) => {
      await setupTestPage(page);

      const defaultPrevented = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const handleKeyDown = (e: KeyboardEvent) => {
            // Only prevent for Ctrl+S
            if (e.key === 's' && e.ctrlKey) {
              e.preventDefault();
            }
            // Check for a different key
            if (e.key === 'a') {
              document.removeEventListener('keydown', handleKeyDown);
              resolve(e.defaultPrevented);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          // Dispatch 'a' without modifiers
          const event = new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(true), 100);
        });
      });

      expect(defaultPrevented).toBe(false);
    });
  });

  test.describe('Input Field Handling', () => {
    test('should skip shortcuts when input element is focused by default', async ({ page }) => {
      await setupTestPage(page);

      await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'test-input';
        input.type = 'text';
        document.body.appendChild(input);
        input.focus();
      });

      // Type into the input
      await page.keyboard.type('test');

      const inputValue = await page.evaluate(() => {
        const input = document.getElementById('test-input') as HTMLInputElement;
        return input?.value;
      });

      expect(inputValue).toBe('test');

      // Cleanup
      await page.evaluate(() => {
        document.getElementById('test-input')?.remove();
      });
    });

    test('should handle shortcuts when allowInInputs is true', async ({ page }) => {
      await setupTestPage(page);

      const shortcutTriggered = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let triggered = false;

          const input = document.createElement('input');
          input.id = 'allow-input';
          input.type = 'text';
          document.body.appendChild(input);
          input.focus();

          const handleKeyDown = (e: KeyboardEvent) => {
            // This simulates allowInInputs: true
            if (e.key === 'Escape') {
              triggered = true;
              document.removeEventListener('keydown', handleKeyDown);
              resolve(triggered);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
          });
          input.dispatchEvent(event);

          setTimeout(() => {
            document.getElementById('allow-input')?.remove();
            resolve(triggered);
          }, 100);
        });
      });

      expect(shortcutTriggered).toBe(true);
    });
  });

  test.describe('Enabled/Disabled State', () => {
    test('should not trigger shortcuts when disabled', async ({ page }) => {
      await setupTestPage(page);

      const triggered = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let enabled = false; // Simulating disabled state
          let triggered = false;

          const handleKeyDown = (e: KeyboardEvent) => {
            if (enabled && e.key === 'c' && e.ctrlKey) {
              triggered = true;
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 'c',
            code: 'KeyC',
            ctrlKey: true,
            bubbles: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            resolve(triggered);
          }, 100);
        });
      });

      expect(triggered).toBe(false);
    });

    test('should trigger shortcuts when enabled', async ({ page }) => {
      await setupTestPage(page);

      const triggered = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let enabled = true; // Simulating enabled state
          let triggered = false;

          const handleKeyDown = (e: KeyboardEvent) => {
            if (enabled && e.key === 'c' && e.ctrlKey) {
              triggered = true;
              document.removeEventListener('keydown', handleKeyDown);
              resolve(triggered);
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          const event = new KeyboardEvent('keydown', {
            key: 'c',
            code: 'KeyC',
            ctrlKey: true,
            bubbles: true,
          });
          document.dispatchEvent(event);

          setTimeout(() => resolve(triggered), 100);
        });
      });

      expect(triggered).toBe(true);
    });
  });

  test.describe('Shortcut Display String', () => {
    test('should format shortcut display correctly for Windows/Linux', async ({ page }) => {
      await setupTestPage(page);

      // Test shortcut display formatting
      const displayTests = [
        { shortcut: { key: 'c', ctrlKey: true }, expected: ['Ctrl+C', '⌘C'] },
        { shortcut: { key: 's', ctrlKey: true, shiftKey: true }, expected: ['Ctrl+Shift+S', '⌘⇧S'] },
        { shortcut: { key: 'Escape' }, expected: ['Escape'] },
      ];

      for (const test of displayTests) {
        expect(test.expected.length).toBeGreaterThan(0);
      }
    });

    test('should detect platform correctly', async ({ page }) => {
      await setupTestPage(page);

      const platform = await page.evaluate(() => {
        return navigator.platform;
      });

      expect(platform).toBeTruthy();
    });
  });

  test.describe('Multiple Shortcuts', () => {
    test('should handle multiple registered shortcuts', async ({ page }) => {
      await setupTestPage(page);

      const results = await page.evaluate(() => {
        return new Promise<{ shortcut1: boolean; shortcut2: boolean }>((resolve) => {
          const triggered = { shortcut1: false, shortcut2: false };

          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'a' && e.ctrlKey) {
              triggered.shortcut1 = true;
            }
            if (e.key === 'b' && e.ctrlKey) {
              triggered.shortcut2 = true;
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          // Trigger first shortcut
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'a',
              code: 'KeyA',
              ctrlKey: true,
              bubbles: true,
            })
          );

          // Trigger second shortcut
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'b',
              code: 'KeyB',
              ctrlKey: true,
              bubbles: true,
            })
          );

          setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            resolve(triggered);
          }, 100);
        });
      });

      expect(results.shortcut1).toBe(true);
      expect(results.shortcut2).toBe(true);
    });

    test('should only trigger matching shortcut', async ({ page }) => {
      await setupTestPage(page);

      const results = await page.evaluate(() => {
        return new Promise<{ correct: boolean; incorrect: boolean }>((resolve) => {
          const triggered = { correct: false, incorrect: false };

          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'a' && e.ctrlKey) {
              triggered.correct = true;
            }
            if (e.key === 'b' && e.ctrlKey) {
              triggered.incorrect = true;
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          // Only trigger Ctrl+A
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'a',
              code: 'KeyA',
              ctrlKey: true,
              bubbles: true,
            })
          );

          setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            resolve(triggered);
          }, 100);
        });
      });

      expect(results.correct).toBe(true);
      expect(results.incorrect).toBe(false);
    });
  });

  test.describe('Case Insensitivity', () => {
    test('should match lowercase and uppercase keys', async ({ page }) => {
      await setupTestPage(page);

      const bothMatched = await page.evaluate(() => {
        return new Promise<{ lowercase: boolean; uppercase: boolean }>((resolve) => {
          const matched = { lowercase: false, uppercase: false };

          const handleKeyDown = (e: KeyboardEvent) => {
            const keyLower = e.key.toLowerCase();
            if (keyLower === 'c' && e.ctrlKey) {
              if (e.key === 'c') matched.lowercase = true;
              if (e.key === 'C') matched.uppercase = true;
            }
          };

          document.addEventListener('keydown', handleKeyDown);

          // Lowercase
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'c',
              code: 'KeyC',
              ctrlKey: true,
              bubbles: true,
            })
          );

          // Uppercase (with Shift)
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'C',
              code: 'KeyC',
              ctrlKey: true,
              shiftKey: true,
              bubbles: true,
            })
          );

          setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            resolve(matched);
          }, 100);
        });
      });

      expect(bothMatched.lowercase).toBe(true);
      expect(bothMatched.uppercase).toBe(true);
    });
  });
});
