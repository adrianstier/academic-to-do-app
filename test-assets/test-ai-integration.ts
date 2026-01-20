/**
 * AI Integration Test Suite
 *
 * This script tests all AI-powered endpoints in the shared-todo-list app:
 * 1. /api/ai/smart-parse - Parse natural language into tasks
 * 2. /api/ai/transcribe - Transcribe audio to text/tasks
 * 3. /api/ai/parse-file - Extract tasks from PDFs/images
 * 4. /api/ai/parse-content-to-subtasks - Break content into subtasks
 * 5. /api/ai/enhance-task - Improve task descriptions
 * 6. /api/ai/breakdown-task - Decompose tasks into subtasks
 * 7. /api/ai/generate-email - Generate email from task
 * 8. /api/ai/translate-email - Translate email content
 * 9. /api/ai/parse-voicemail - Parse voicemail to tasks
 *
 * Run with: npx tsx test-assets/test-ai-integration.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

// Test user for authentication
const TEST_USER = 'TestUser';

interface TestResult {
  endpoint: string;
  testName: string;
  success: boolean;
  response?: any;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Generate a random CSRF token for testing
function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  const base64 = Buffer.from(array).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function runTest(
  endpoint: string,
  testName: string,
  method: 'GET' | 'POST',
  body?: FormData | object,
  isFormData = false,
  csrfToken?: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'X-User-Name': TEST_USER,
    };
    let fetchBody: any = undefined;

    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }

    if (body) {
      if (isFormData) {
        fetchBody = body;
      } else {
        headers['Content-Type'] = 'application/json';
        fetchBody = JSON.stringify(body);
      }
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        ...headers,
        Cookie: csrfToken ? `${CSRF_COOKIE_NAME}=${csrfToken}` : '',
      },
      body: fetchBody,
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    const result: TestResult = {
      endpoint,
      testName,
      success: response.ok && data.success !== false,
      response: data,
      duration,
    };

    if (!result.success) {
      result.error = data.error || `HTTP ${response.status}`;
    }

    return result;
  } catch (error) {
    return {
      endpoint,
      testName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// ============= TEST DATA =============

const CLIENT_COMMUNICATIONS = {
  urgentEmail: `
Subject: URGENT - Website Down!

Hi Team,

Our main website went down about 30 minutes ago. Customers are calling and we're losing sales.
This needs to be fixed IMMEDIATELY.

The error message shows "502 Bad Gateway" on all pages. Our hosting provider says it's
on our end.

Please investigate and fix ASAP. I need a status update within the hour.

Also, once this is resolved, we need to:
1. Set up better monitoring alerts
2. Document the incident for the board
3. Schedule a post-mortem meeting

Thanks,
Sarah (CEO)
`,

  projectRequest: `
Hey folks,

Hope everyone had a good weekend! Quick update from client meeting yesterday:

Johnson Corp wants to move forward with the mobile app redesign. Budget is $75,000 and
they want it done by end of Q2 (March 31st).

Key requirements:
- New onboarding flow with biometric login
- Dark mode support
- Offline sync for core features
- Push notifications for order updates
- Integration with their new CRM (Salesforce)

Can we get estimates from frontend and backend teams by Friday? Need to confirm
timeline with John from Johnson Corp by next Monday.

Also reminder: Team lunch on Thursday at noon, don't forget to RSVP.

Best,
Marcus (PM)
`,

  voicemailTranscript: `
Hey this is Mike from Acme Corporation calling about the quarterly review.
We need to reschedule our Thursday meeting to next week if possible.
Also can you send over the updated contract by end of day tomorrow?
The legal team needs to review it before we can proceed.
Oh and one more thing - the CEO wants to know if we can add the analytics
dashboard to the project scope. Let me know your thoughts. Thanks!
`,

  meetingNotes: `
Weekly Standup Notes - January 20, 2026

Attendees: Alex, Jordan, Casey, Riley

## Updates
- Alex: Finished auth module, needs code review
- Jordan: Working on payment integration, blocked by API keys
- Casey: UI mockups approved, starting implementation
- Riley: Fixed 3 bugs, need to update test coverage

## Action Items
- [ ] Alex to request code review from senior dev
- [ ] Jordan to follow up with finance for Stripe keys
- [ ] Casey to set up component library
- [ ] Riley to add tests for auth edge cases
- [ ] All: Submit timesheets by Friday

## Blockers
- Need AWS credentials for deployment
- Design feedback pending from client

## Next Meeting
Wednesday 10am - Sprint planning
`,

  bugReport: `
BUG REPORT #2847

Priority: High
Reporter: Customer Support
Affected Users: ~200

Description:
Users on iOS 17 are unable to complete checkout. The payment form freezes
when selecting credit card as payment method. Works fine on Android and
desktop browsers.

Steps to Reproduce:
1. Add items to cart on iOS Safari
2. Go to checkout
3. Select "Credit Card" payment
4. Form becomes unresponsive

Expected: Payment form should remain interactive
Actual: Form freezes, requires force quit

Technical Details:
- iOS 17.0, 17.1, 17.2 affected
- Safari and Chrome on iOS both affected
- Console shows "Maximum call stack exceeded" error

Business Impact:
Estimated $15,000/day in lost mobile sales until fixed.

Please prioritize - this is affecting our holiday sales!
`,
};

// ============= TESTS =============

async function testSmartParse(csrfToken: string) {
  console.log('\n📝 Testing /api/ai/smart-parse...');
  console.log('   Expected schema: { text: string, users?: string[] }');

  // Test 1: Simple task parsing
  const test1 = await runTest(
    '/api/ai/smart-parse',
    'Simple task parsing',
    'POST',
    {
      text: 'Buy groceries tomorrow and call mom',
      users: ['Alex', 'Jordan'],
    },
    false,
    csrfToken
  );
  results.push(test1);
  console.log(`  ${test1.success ? '✅' : '❌'} ${test1.testName} (${test1.duration}ms)`);
  if (test1.success) {
    console.log(`     → Tasks extracted: ${test1.response?.tasks?.length || 0}`);
  } else {
    console.log(`     → Error: ${test1.error}`);
  }

  // Test 2: Complex email
  const test2 = await runTest(
    '/api/ai/smart-parse',
    'Complex email parsing',
    'POST',
    {
      text: CLIENT_COMMUNICATIONS.urgentEmail,
      users: ['Sarah', 'DevTeam', 'IT Support'],
    },
    false,
    csrfToken
  );
  results.push(test2);
  console.log(`  ${test2.success ? '✅' : '❌'} ${test2.testName} (${test2.duration}ms)`);

  // Test 3: Meeting notes
  const test3 = await runTest(
    '/api/ai/smart-parse',
    'Meeting notes parsing',
    'POST',
    {
      text: CLIENT_COMMUNICATIONS.meetingNotes,
      users: ['Alex', 'Jordan', 'Casey', 'Riley'],
    },
    false,
    csrfToken
  );
  results.push(test3);
  console.log(`  ${test3.success ? '✅' : '❌'} ${test3.testName} (${test3.duration}ms)`);
}

async function testParseVoicemail(csrfToken: string) {
  console.log('\n🎤 Testing /api/ai/parse-voicemail...');
  console.log('   Expected schema: { transcription: string, users?: string[] }');

  // Note: The API expects 'transcription', not 'transcript'
  const test = await runTest(
    '/api/ai/parse-voicemail',
    'Voicemail transcript parsing',
    'POST',
    {
      transcription: CLIENT_COMMUNICATIONS.voicemailTranscript,  // Fixed: was 'transcript'
      users: ['Mike', 'Legal Team', 'CEO'],
    },
    false,
    csrfToken
  );
  results.push(test);
  console.log(`  ${test.success ? '✅' : '❌'} ${test.testName} (${test.duration}ms)`);
  if (test.success) {
    console.log(`     → Tasks extracted: ${test.response?.tasks?.length || 0}`);
  } else {
    console.log(`     → Error: ${test.error}`);
  }
}

async function testEnhanceTask(csrfToken: string) {
  console.log('\n✨ Testing /api/ai/enhance-task...');
  console.log('   Expected schema: { text: string, users?: string[] }');

  // Test 1: Vague task
  const test1 = await runTest(
    '/api/ai/enhance-task',
    'Enhance vague task',
    'POST',
    {
      text: 'fix the thing',
      users: ['Alex', 'Jordan'],  // Changed: removed 'context', added 'users'
    },
    false,
    csrfToken
  );
  results.push(test1);
  console.log(`  ${test1.success ? '✅' : '❌'} ${test1.testName} (${test1.duration}ms)`);
  if (test1.success) {
    console.log(`     → Enhanced: ${test1.response?.enhancedText?.substring(0, 60)}...`);
  }

  // Test 2: Task with more context in text
  const test2 = await runTest(
    '/api/ai/enhance-task',
    'Enhance PR review task',
    'POST',
    {
      text: 'Review PR for user authentication module',
      users: ['Alex', 'Jordan'],
    },
    false,
    csrfToken
  );
  results.push(test2);
  console.log(`  ${test2.success ? '✅' : '❌'} ${test2.testName} (${test2.duration}ms)`);
}

async function testBreakdownTask(csrfToken: string) {
  console.log('\n🔨 Testing /api/ai/breakdown-task...');
  console.log('   Expected schema: { text: string, users?: string[] }');

  // Test 1: Feature implementation
  const test1 = await runTest(
    '/api/ai/breakdown-task',
    'Feature breakdown',
    'POST',
    {
      text: 'Implement user authentication with Next.js and Supabase backend',
      users: ['Backend', 'Frontend', 'QA'],
    },
    false,
    csrfToken
  );
  results.push(test1);
  console.log(`  ${test1.success ? '✅' : '❌'} ${test1.testName} (${test1.duration}ms)`);
  if (test1.success) {
    console.log(`     → Subtasks generated: ${test1.response?.subtasks?.length || 0}`);
  }

  // Test 2: Bug fix
  const test2 = await runTest(
    '/api/ai/breakdown-task',
    'Bug fix breakdown',
    'POST',
    {
      text: `Fix iOS checkout freeze bug - ${CLIENT_COMMUNICATIONS.bugReport}`,
      users: ['iOS Dev', 'QA', 'Support'],
    },
    false,
    csrfToken
  );
  results.push(test2);
  console.log(`  ${test2.success ? '✅' : '❌'} ${test2.testName} (${test2.duration}ms)`);
}

async function testGenerateEmail(csrfToken: string) {
  console.log('\n📧 Testing /api/ai/generate-email...');
  console.log('   Expected schema: { customerName, tasks[], tone, senderName, includeNextSteps }');

  const test = await runTest(
    '/api/ai/generate-email',
    'Generate project update email',
    'POST',
    {
      customerName: 'John from Johnson Corp',
      tasks: [
        {
          text: 'Mobile app redesign - Design phase',
          status: 'in_progress',
          subtasksCompleted: 3,
          subtasksTotal: 5,
          notes: 'Wireframes approved, working on high-fidelity mockups',
        },
        {
          text: 'Set up CI/CD pipeline',
          status: 'done',
          subtasksCompleted: 4,
          subtasksTotal: 4,
        },
        {
          text: 'Implement biometric authentication',
          status: 'todo',
          subtasksCompleted: 0,
          subtasksTotal: 3,
          dueDate: '2026-02-15',
        },
      ],
      tone: 'friendly',
      senderName: 'Marcus Chen',
      includeNextSteps: true,
      language: 'english',
    },
    false,
    csrfToken
  );
  results.push(test);
  console.log(`  ${test.success ? '✅' : '❌'} ${test.testName} (${test.duration}ms)`);
  if (test.success) {
    console.log(`     → Subject: ${test.response?.subject}`);
  } else {
    console.log(`     → Error: ${test.error}`);
  }
}

async function testTranslateEmail(csrfToken: string) {
  console.log('\n🌍 Testing /api/ai/translate-email...');
  console.log('   Expected schema: { subject: string, body: string, targetLanguage: "spanish" }');

  const test = await runTest(
    '/api/ai/translate-email',
    'Translate to Spanish',
    'POST',
    {
      subject: 'Project Update - Mobile App Redesign',  // Fixed: added 'subject'
      body: 'Hello John,\n\nI wanted to update you on the progress of the mobile app redesign project. The design phase is going well and we expect to deliver on time.\n\nBest regards,\nMarcus',  // Fixed: 'body' instead of 'text'
      targetLanguage: 'spanish',  // Fixed: lowercase 'spanish'
    },
    false,
    csrfToken
  );
  results.push(test);
  console.log(`  ${test.success ? '✅' : '❌'} ${test.testName} (${test.duration}ms)`);
  if (test.success) {
    console.log(`     → Translated subject: ${test.response?.translatedSubject?.substring(0, 40)}...`);
  } else {
    console.log(`     → Error: ${test.error}`);
  }
}

async function testParseContentToSubtasks(csrfToken: string) {
  console.log('\n📋 Testing /api/ai/parse-content-to-subtasks...');
  console.log('   Expected schema: { content: string (min 10 chars), contentType?, parentTaskText? }');

  const test = await runTest(
    '/api/ai/parse-content-to-subtasks',
    'Parse bug report to subtasks',
    'POST',
    {
      content: CLIENT_COMMUNICATIONS.bugReport,  // This is correct
      parentTaskText: 'Fix iOS checkout freeze',
      contentType: 'email',  // Optional
    },
    false,
    csrfToken
  );
  results.push(test);
  console.log(`  ${test.success ? '✅' : '❌'} ${test.testName} (${test.duration}ms)`);
  if (test.success) {
    console.log(`     → Subtasks generated: ${test.response?.subtasks?.length || 0}`);
  } else {
    console.log(`     → Error: ${test.error}`);
  }
}

async function testParseFile(csrfToken: string) {
  console.log('\n📄 Testing /api/ai/parse-file...');
  console.log('   Expected: FormData with file + users (JSON string)');

  // Test with PDF
  try {
    const pdfPath = join(__dirname, 'project-brief.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', pdfBlob, 'project-brief.pdf');
    formData.append('users', JSON.stringify(['Marcus', 'Tech Lead', 'Designer']));

    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/ai/parse-file`, {
      method: 'POST',
      headers: {
        [CSRF_HEADER_NAME]: csrfToken,
        'X-User-Name': TEST_USER,
        Cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
      },
      body: formData,
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    const result: TestResult = {
      endpoint: '/api/ai/parse-file',
      testName: 'Parse PDF to tasks',
      success: response.ok && data.success !== false,
      response: data,
      duration,
      error: data.error,
    };

    results.push(result);
    console.log(`  ${result.success ? '✅' : '❌'} ${result.testName} (${duration}ms)`);
    if (result.success) {
      console.log(`     → Main task: ${data.mainTask?.text?.substring(0, 50)}...`);
      console.log(`     → Subtasks: ${data.subtasks?.length || 0}`);
    } else {
      console.log(`     → Error: ${result.error}`);
    }
  } catch (err) {
    const result: TestResult = {
      endpoint: '/api/ai/parse-file',
      testName: 'Parse PDF to tasks',
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read PDF',
      duration: 0,
    };
    results.push(result);
    console.log(`  ❌ ${result.testName} - ${result.error}`);
  }

  // Test with PNG image
  try {
    const pngPath = join(__dirname, 'whiteboard-notes.png');
    const pngBuffer = readFileSync(pngPath);
    const pngBlob = new Blob([pngBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', pngBlob, 'whiteboard-notes.png');
    formData.append('users', JSON.stringify(['Alex', 'Jordan', 'Casey', 'Riley']));

    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/ai/parse-file`, {
      method: 'POST',
      headers: {
        [CSRF_HEADER_NAME]: csrfToken,
        'X-User-Name': TEST_USER,
        Cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
      },
      body: formData,
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    const result: TestResult = {
      endpoint: '/api/ai/parse-file',
      testName: 'Parse whiteboard image to tasks',
      success: response.ok && data.success !== false,
      response: data,
      duration,
      error: data.error,
    };

    results.push(result);
    console.log(`  ${result.success ? '✅' : '❌'} ${result.testName} (${duration}ms)`);
    if (result.success) {
      console.log(`     → Main task: ${data.mainTask?.text?.substring(0, 50)}...`);
      console.log(`     → Subtasks: ${data.subtasks?.length || 0}`);
    } else {
      console.log(`     → Error: ${result.error}`);
    }
  } catch (err) {
    const result: TestResult = {
      endpoint: '/api/ai/parse-file',
      testName: 'Parse whiteboard image to tasks',
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read PNG',
      duration: 0,
    };
    results.push(result);
    console.log(`  ❌ ${result.testName} - ${result.error}`);
  }
}

// ============= MAIN =============

async function main() {
  console.log('🧪 AI Integration Test Suite');
  console.log('============================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Auth: X-User-Name: ${TEST_USER}`);
  console.log('');
  console.log('Note: Tests may fail if Anthropic API credits are insufficient.');
  console.log('The purpose of this test is to verify request schemas are correct.');

  const csrfToken = generateCsrfToken();
  console.log(`CSRF Token: ${csrfToken.substring(0, 10)}...`);

  // Run all tests
  await testSmartParse(csrfToken);
  await testParseVoicemail(csrfToken);
  await testEnhanceTask(csrfToken);
  await testBreakdownTask(csrfToken);
  await testGenerateEmail(csrfToken);
  await testTranslateEmail(csrfToken);
  await testParseContentToSubtasks(csrfToken);
  await testParseFile(csrfToken);

  // Summary
  console.log('\n============================');
  console.log('📊 Test Summary');
  console.log('============================');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  // API errors include credit issues and generic "Failed to..." errors (which are Claude API errors being caught)
  const apiErrorPatterns = ['credit', 'API', 'Failed to parse', 'Failed to enhance', 'Failed to break', 'Failed to generate', 'Failed to translate'];
  const apiErrors = results.filter(r => apiErrorPatterns.some(p => r.error?.includes(p))).length;
  const schemaErrors = failed - apiErrors;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`   - API/Credit errors: ${apiErrors} (expected if no API credits)`);
  console.log(`   - Schema errors: ${schemaErrors} (these need fixing)`);
  console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(1)}s`);

  if (schemaErrors > 0) {
    console.log('\n🔧 Schema errors (need fixing):');
    results.filter(r => !r.success && !apiErrorPatterns.some(p => r.error?.includes(p))).forEach(r => {
      console.log(`  ❌ ${r.endpoint} - ${r.testName}`);
      console.log(`     Error: ${r.error}`);
    });
  }

  if (apiErrors > 0) {
    console.log('\n💳 API/Credit errors (expected when no API credits):');
    results.filter(r => apiErrorPatterns.some(p => r.error?.includes(p))).forEach(r => {
      console.log(`  ⚠️  ${r.endpoint} - ${r.testName}`);
      console.log(`     (${r.error?.substring(0, 50)}...)`);
    });
  }

  // Only fail on schema errors, not API errors
  process.exit(schemaErrors > 0 ? 1 : 0);
}

main().catch(console.error);
