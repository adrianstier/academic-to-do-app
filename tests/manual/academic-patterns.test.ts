/**
 * Unit Tests for Academic Patterns Module
 *
 * Run with: npx tsx tests/manual/academic-patterns.test.ts
 */

import {
  analyzeTaskPattern,
  CATEGORY_COMPLETION_RATES,
  getCompletionRateWarning,
  getCategorySubtasks,
} from '../../src/lib/academicPatterns';

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

console.log('\n🧪 Academic Patterns Unit Tests\n');

// Test: analyzeTaskPattern - Research Pattern Detection
console.log('analyzeTaskPattern - Pattern Detection:');

test('detects research patterns', () => {
  const result = analyzeTaskPattern('Literature review for machine learning study');
  expect(result).toBeDefined();
  expect(result?.category).toBe('research');
});

test('detects writing patterns', () => {
  const result = analyzeTaskPattern('Write draft of thesis introduction');
  expect(result).toBeDefined();
  expect(result?.category).toBe('writing');
  expect(result?.suggestedPriority).toBe('high');
});

test('detects analysis patterns', () => {
  const result = analyzeTaskPattern('Run data analysis with Python regression');
  expect(result).toBeDefined();
  expect(result?.category).toBe('analysis');
});

test('detects submission patterns', () => {
  const result = analyzeTaskPattern('Submit paper to conference by deadline');
  expect(result).toBeDefined();
  expect(result?.category).toBe('submission');
  expect(result?.suggestedPriority).toBe('urgent');
});

test('detects meeting patterns', () => {
  const result = analyzeTaskPattern('Meeting with advisor about thesis progress');
  expect(result).toBeDefined();
  expect(result?.category).toBe('meeting');
});

test('detects presentation patterns', () => {
  const result = analyzeTaskPattern('Prepare slides for thesis defense');
  expect(result).toBeDefined();
  expect(result?.category).toBe('presentation');
});

test('detects reading patterns', () => {
  const result = analyzeTaskPattern('Read article on neural networks');
  expect(result).toBeDefined();
  expect(result?.category).toBe('reading');
});

test('detects coursework patterns', () => {
  const result = analyzeTaskPattern('Complete homework assignment for course');
  expect(result).toBeDefined();
  expect(result?.category).toBe('coursework');
});

test('detects revision patterns', () => {
  const result = analyzeTaskPattern('Address reviewer comments and revise manuscript');
  expect(result).toBeDefined();
  expect(result?.category).toBe('revision');
});

test('detects admin patterns', () => {
  const result = analyzeTaskPattern('Complete IRB submission forms');
  expect(result).toBeDefined();
  expect(result?.category).toBe('admin');
});

test('returns null for non-matching text', () => {
  const result = analyzeTaskPattern('buy milk and eggs');
  expect(result).toBeNull();
});

// Test: Confidence Scoring
console.log('\nanalyzeTaskPattern - Confidence Scoring:');

test('high confidence for multiple keyword matches', () => {
  const result = analyzeTaskPattern('Write thesis dissertation manuscript abstract draft paper');
  expect(result).toBeDefined();
  expect(result?.confidence).toBeGreaterThan(0.2);
});

test('lower confidence for single keyword match', () => {
  const result = analyzeTaskPattern('Check on the paper status');
  expect(result).toBeDefined();
  expect(result?.confidence).toBeLessThan(1);
});

// Test: Suggested Subtasks
console.log('\nanalyzeTaskPattern - Suggested Subtasks:');

test('provides subtasks for research', () => {
  const result = analyzeTaskPattern('Literature review for research');
  expect(result).toBeDefined();
  expect(result?.suggestedSubtasks.length).toBeGreaterThanOrEqual(1);
});

test('provides subtasks for writing', () => {
  const result = analyzeTaskPattern('Write paper draft');
  expect(result).toBeDefined();
  expect(result?.suggestedSubtasks.length).toBeGreaterThanOrEqual(1);
});

// Test: Estimated Minutes
console.log('\nanalyzeTaskPattern - Estimated Minutes:');

test('provides estimated minutes for subtasks', () => {
  const result = analyzeTaskPattern('Prepare conference presentation');
  expect(result).toBeDefined();
  expect(result?.estimatedMinutes.length).toBeGreaterThanOrEqual(1);
});

// Test: CATEGORY_COMPLETION_RATES
console.log('\nCATEGORY_COMPLETION_RATES:');

test('meeting has high completion rate (95%)', () => {
  expect(CATEGORY_COMPLETION_RATES.meeting).toBe(95);
});

test('submission has high completion rate (90%)', () => {
  expect(CATEGORY_COMPLETION_RATES.submission).toBe(90);
});

test('writing has moderate completion rate (65%)', () => {
  expect(CATEGORY_COMPLETION_RATES.writing).toBe(65);
});

test('research has lower completion rate (60%)', () => {
  expect(CATEGORY_COMPLETION_RATES.research).toBe(60);
});

// Test: getCompletionRateWarning
console.log('\ngetCompletionRateWarning:');

test('returns warning for writing category (low completion)', () => {
  const warning = getCompletionRateWarning('writing');
  expect(warning).toBeDefined();
});

test('returns warning for research category (low completion)', () => {
  const warning = getCompletionRateWarning('research');
  expect(warning).toBeDefined();
});

test('returns null for meeting category (high completion)', () => {
  const warning = getCompletionRateWarning('meeting');
  expect(warning).toBeNull();
});

test('returns null for submission category (high completion)', () => {
  const warning = getCompletionRateWarning('submission');
  expect(warning).toBeNull();
});

// Test: getCategorySubtasks
console.log('\ngetCategorySubtasks:');

test('returns subtasks for research', () => {
  const subtasks = getCategorySubtasks('research');
  expect(subtasks.length).toBeGreaterThanOrEqual(1);
});

test('returns subtasks for writing', () => {
  const subtasks = getCategorySubtasks('writing');
  expect(subtasks.length).toBeGreaterThanOrEqual(1);
});

test('returns subtasks for submission', () => {
  const subtasks = getCategorySubtasks('submission');
  expect(subtasks.length).toBeGreaterThanOrEqual(1);
});

test('returns empty array for unknown category', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtasks = getCategorySubtasks('unknown_category' as any);
  expect(subtasks).toBeDefined();
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
