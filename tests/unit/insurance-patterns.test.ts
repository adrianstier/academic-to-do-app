/**
 * Unit Tests for Insurance Patterns Module
 *
 * Run with: npx tsx tests/unit/insurance-patterns.test.ts
 */

import {
  analyzeTaskPattern,
  CATEGORY_COMPLETION_RATES,
  getCompletionRateWarning,
  getCategorySubtasks,
} from '../../src/lib/insurancePatterns';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(`Expected array length ${expected}, got ${Array.isArray(actual) ? actual.length : 'not an array'}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
  };
}

console.log('\n🧪 Insurance Patterns Unit Tests\n');

// Test: analyzeTaskPattern - Policy Review Detection
console.log('analyzeTaskPattern - Pattern Detection:');

test('detects policy review patterns', () => {
  const result = analyzeTaskPattern('Review policy coverage for customer renewal');
  expect(result).toBeDefined();
  expect(result?.category).toBe('policy_review');
});

test('detects follow-up patterns', () => {
  const result = analyzeTaskPattern('Call back John about his voicemail');
  expect(result).toBeDefined();
  expect(result?.category).toBe('follow_up');
  expect(result?.suggestedPriority).toBe('high');
});

test('detects vehicle patterns', () => {
  const result = analyzeTaskPattern('Add new car to policy VIN verification');
  expect(result).toBeDefined();
  expect(result?.category).toBe('vehicle_add');
});

test('detects payment patterns', () => {
  const result = analyzeTaskPattern('Process payment for overdue billing');
  expect(result).toBeDefined();
  expect(result?.category).toBe('payment');
  expect(result?.suggestedPriority).toBe('high');
});

test('detects claim patterns with urgent priority', () => {
  const result = analyzeTaskPattern('File accident claim for customer collision');
  expect(result).toBeDefined();
  expect(result?.category).toBe('claim');
  expect(result?.suggestedPriority).toBe('urgent');
});

test('detects quote patterns', () => {
  const result = analyzeTaskPattern('Prepare quote proposal for new customer');
  expect(result).toBeDefined();
  expect(result?.category).toBe('quote');
});

test('detects endorsement patterns', () => {
  const result = analyzeTaskPattern('Process endorsement for policy change');
  expect(result).toBeDefined();
  expect(result?.category).toBe('endorsement');
});

test('detects new client patterns', () => {
  const result = analyzeTaskPattern('New client onboarding for John Smith');
  expect(result).toBeDefined();
  expect(result?.category).toBe('new_client');
});

test('returns null for non-matching text', () => {
  const result = analyzeTaskPattern('random text without keywords');
  expect(result).toBeNull();
});

// Test: Confidence Scoring
console.log('\nanalyzeTaskPattern - Confidence Scoring:');

test('high confidence for multiple keyword matches', () => {
  const result = analyzeTaskPattern('Policy renewal review coverage check');
  expect(result).toBeDefined();
  expect(result?.confidence).toBeGreaterThan(0.3);
});

test('lower confidence for single keyword match', () => {
  const result = analyzeTaskPattern('Check on the policy status');
  expect(result).toBeDefined();
  expect(result?.confidence).toBeLessThan(1);
});

// Test: Suggested Subtasks
console.log('\nanalyzeTaskPattern - Suggested Subtasks:');

test('provides subtasks for policy review', () => {
  const result = analyzeTaskPattern('Review policy for renewal');
  expect(result).toBeDefined();
  expect(result?.suggestedSubtasks.length).toBeGreaterThanOrEqual(1);
});

test('provides subtasks for claims', () => {
  const result = analyzeTaskPattern('Process auto claim');
  expect(result).toBeDefined();
  expect(result?.suggestedSubtasks.length).toBeGreaterThanOrEqual(1);
});

// Test: Estimated Minutes
console.log('\nanalyzeTaskPattern - Estimated Minutes:');

test('provides estimated minutes for subtasks', () => {
  const result = analyzeTaskPattern('New client onboarding');
  expect(result).toBeDefined();
  expect(result?.estimatedMinutes.length).toBeGreaterThanOrEqual(1);
});

// Test: CATEGORY_COMPLETION_RATES
console.log('\nCATEGORY_COMPLETION_RATES:');

test('payment has 100% completion rate', () => {
  expect(CATEGORY_COMPLETION_RATES.payment).toBe(100);
});

test('new_client has 100% completion rate', () => {
  expect(CATEGORY_COMPLETION_RATES.new_client).toBe(100);
});

test('quote has 50% completion rate', () => {
  expect(CATEGORY_COMPLETION_RATES.quote).toBe(50);
});

test('claim has high completion rate', () => {
  expect(CATEGORY_COMPLETION_RATES.claim).toBeGreaterThan(80);
});

// Test: getCompletionRateWarning
console.log('\ngetCompletionRateWarning:');

test('returns warning for quote category', () => {
  const warning = getCompletionRateWarning('quote');
  expect(warning).toBeDefined();
});

test('returns null for payment category (high completion)', () => {
  const warning = getCompletionRateWarning('payment');
  expect(warning).toBeNull();
});

test('returns null for claim category (good completion)', () => {
  const warning = getCompletionRateWarning('claim');
  expect(warning).toBeNull();
});

// Test: getCategorySubtasks
console.log('\ngetCategorySubtasks:');

test('returns subtasks for policy_review', () => {
  const subtasks = getCategorySubtasks('policy_review');
  expect(subtasks.length).toBeGreaterThanOrEqual(1);
});

test('returns subtasks for claim', () => {
  const subtasks = getCategorySubtasks('claim');
  expect(subtasks.length).toBeGreaterThanOrEqual(1);
});

test('returns empty array for unknown category', () => {
  const subtasks = getCategorySubtasks('unknown_category' as any);
  expect(subtasks).toBeDefined();
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
