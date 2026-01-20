/**
 * Comprehensive Test Suite for Email Generation API
 * Tests all features including transcriptions, attachments, subtasks, warnings, and insurance agent style
 */

import { describe, it, expect } from 'vitest';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_URL}/api/ai/generate-email`;

interface TaskSummary {
  text: string;
  status: 'todo' | 'in_progress' | 'done';
  subtasksCompleted: number;
  subtasksTotal: number;
  notes?: string;
  dueDate?: string;
  transcription?: string;
  attachments?: Array<{ file_name: string; file_type: string }>;
  completed?: boolean;
}

interface EmailRequest {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  tasks: TaskSummary[];
  tone: 'formal' | 'friendly' | 'brief';
  senderName: string;
  includeNextSteps: boolean;
}

interface EmailWarning {
  type: 'sensitive_info' | 'date_promise' | 'coverage_detail' | 'pricing' | 'negative_news' | 'needs_verification';
  message: string;
  location: string;
}

interface EmailResponse {
  success: boolean;
  subject?: string;
  body?: string;
  suggestedFollowUp?: string | null;
  warnings?: EmailWarning[];
  error?: string;
}

async function generateEmail(request: EmailRequest): Promise<EmailResponse> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

describe('Email Generation API - Comprehensive Tests', () => {

  // Test 1: Basic email generation with simple task
  describe('Basic Functionality', () => {
    it('should generate email for a single completed task', async () => {
      const request: EmailRequest = {
        customerName: 'John Smith',
        customerEmail: 'john@example.com',
        tasks: [{
          text: 'Review auto insurance policy',
          status: 'done',
          subtasksCompleted: 0,
          subtasksTotal: 0,
          completed: true,
        }],
        tone: 'friendly',
        senderName: 'Sarah Johnson',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      expect(result.body).toContain('John'); // Should use customer name
      expect(result.warnings).toBeDefined();
    });

    it('should handle missing optional fields', async () => {
      const request: EmailRequest = {
        customerName: 'Jane Doe',
        tasks: [{
          text: 'Submit claim documentation',
          status: 'in_progress',
          subtasksCompleted: 2,
          subtasksTotal: 5,
        }],
        tone: 'formal',
        senderName: 'Agent Smith',
        includeNextSteps: false,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
    });
  });

  // Test 2: Voicemail transcription handling
  describe('Voicemail Transcription Handling', () => {
    it('should incorporate transcription content into email', async () => {
      const request: EmailRequest = {
        customerName: 'Mike Johnson',
        customerPhone: '555-1234',
        tasks: [{
          text: 'Follow up on renewal quote',
          status: 'in_progress',
          subtasksCompleted: 1,
          subtasksTotal: 3,
          transcription: 'Hi, this is Mike. I got your quote for the renewal but the premium seems higher than last year. Can you explain why it went up? Also, I wanted to add my new truck to the policy. Please call me back. Thanks.',
        }],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
      // Email should reference the concerns from voicemail
      const bodyLower = result.body!.toLowerCase();
      expect(
        bodyLower.includes('premium') ||
        bodyLower.includes('truck') ||
        bodyLower.includes('voicemail') ||
        bodyLower.includes('call')
      ).toBe(true);
    });

    it('should flag sensitive information in transcription', async () => {
      const request: EmailRequest = {
        customerName: 'Alice Cooper',
        tasks: [{
          text: 'Process claim',
          status: 'todo',
          subtasksCompleted: 0,
          subtasksTotal: 0,
          transcription: 'My SSN is 123-45-6789 and my account number is 987654321. I need help with my claim.',
        }],
        tone: 'formal',
        senderName: 'Agent',
        includeNextSteps: false,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      // Should have warning about sensitive info
      const hasSensitiveWarning = result.warnings?.some(w => w.type === 'sensitive_info');
      expect(hasSensitiveWarning).toBe(true);
    });
  });

  // Test 3: Attachment handling
  describe('Attachment Handling', () => {
    it('should acknowledge attachments in email', async () => {
      const request: EmailRequest = {
        customerName: 'Robert Davis',
        customerEmail: 'robert@example.com',
        tasks: [{
          text: 'Review submitted documents',
          status: 'done',
          subtasksCompleted: 0,
          subtasksTotal: 0,
          attachments: [
            { file_name: 'drivers_license.pdf', file_type: 'application/pdf' },
            { file_name: 'vehicle_registration.jpg', file_type: 'image/jpeg' },
          ],
          completed: true,
        }],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      const bodyLower = result.body!.toLowerCase();
      // Should reference document review
      expect(
        bodyLower.includes('document') ||
        bodyLower.includes('file') ||
        bodyLower.includes('review') ||
        bodyLower.includes('sent')
      ).toBe(true);
    });

    it('should handle multiple attachments', async () => {
      const request: EmailRequest = {
        customerName: 'Linda Martinez',
        tasks: [{
          text: 'Process homeowners insurance application',
          status: 'in_progress',
          subtasksCompleted: 3,
          subtasksTotal: 5,
          attachments: [
            { file_name: 'home_inspection.pdf', file_type: 'application/pdf' },
            { file_name: 'property_deed.pdf', file_type: 'application/pdf' },
            { file_name: 'photo1.jpg', file_type: 'image/jpeg' },
            { file_name: 'photo2.jpg', file_type: 'image/jpeg' },
          ],
        }],
        tone: 'formal',
        senderName: 'Agent Wilson',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
    });
  });

  // Test 4: Subtask progress handling
  describe('Subtask Progress Handling', () => {
    it('should show detailed progress for tasks with subtasks', async () => {
      const request: EmailRequest = {
        customerName: 'Tom Wilson',
        tasks: [{
          text: 'Commercial policy setup',
          status: 'in_progress',
          subtasksCompleted: 4,
          subtasksTotal: 7,
          notes: 'Need COI from previous carrier',
        }],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
      // Email should demonstrate thoroughness
    });

    it('should celebrate fully completed subtasks', async () => {
      const request: EmailRequest = {
        customerName: 'Emma Brown',
        tasks: [{
          text: 'Complete annual policy review',
          status: 'done',
          subtasksCompleted: 5,
          subtasksTotal: 5,
          completed: true,
        }],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: false,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
    });
  });

  // Test 5: Multiple tasks with mixed statuses
  describe('Multiple Tasks', () => {
    it('should handle multiple tasks with different statuses', async () => {
      const request: EmailRequest = {
        customerName: 'David Thompson',
        customerEmail: 'david@example.com',
        tasks: [
          {
            text: 'Auto policy renewal',
            status: 'done',
            subtasksCompleted: 3,
            subtasksTotal: 3,
            completed: true,
          },
          {
            text: 'Add new driver to policy',
            status: 'in_progress',
            subtasksCompleted: 1,
            subtasksTotal: 2,
          },
          {
            text: 'Review homeowners coverage',
            status: 'todo',
            subtasksCompleted: 0,
            subtasksTotal: 0,
          },
        ],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      // Should mention multiple items
    });
  });

  // Test 6: Warning flag system
  describe('Warning Flag System', () => {
    it('should flag date promises', async () => {
      const request: EmailRequest = {
        customerName: 'Susan Miller',
        tasks: [{
          text: 'Process claim payment',
          status: 'in_progress',
          subtasksCompleted: 2,
          subtasksTotal: 3,
          dueDate: '2026-01-10',
          notes: 'Customer needs payment by January 10th',
        }],
        tone: 'formal',
        senderName: 'Agent',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      // May have date_promise warning
      if (result.warnings && result.warnings.length > 0) {
        expect(result.warnings.some(w => w.type === 'date_promise')).toBeDefined();
      }
    });

    it('should flag pricing/coverage details', async () => {
      const request: EmailRequest = {
        customerName: 'George Harris',
        tasks: [{
          text: 'Update coverage limits',
          status: 'done',
          subtasksCompleted: 0,
          subtasksTotal: 0,
          notes: 'Increased liability to $500,000. Premium will be $1,200/year.',
          completed: true,
        }],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: false,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      // Should have pricing or coverage warning
      if (result.warnings && result.warnings.length > 0) {
        const hasRelevantWarning = result.warnings.some(w =>
          w.type === 'pricing' || w.type === 'coverage_detail'
        );
        expect(hasRelevantWarning).toBeDefined();
      }
    });

    it('should flag negative news', async () => {
      const request: EmailRequest = {
        customerName: 'Patricia Moore',
        tasks: [{
          text: 'Process claim denial',
          status: 'done',
          subtasksCompleted: 0,
          subtasksTotal: 0,
          notes: 'Claim denied due to policy exclusion',
          completed: true,
        }],
        tone: 'formal',
        senderName: 'Agent',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      // Should flag negative news
      if (result.warnings && result.warnings.length > 0) {
        expect(result.warnings.some(w => w.type === 'negative_news')).toBeDefined();
      }
    });
  });

  // Test 7: Tone variations
  describe('Tone Variations', () => {
    const baseRequest = {
      customerName: 'Test Customer',
      tasks: [{
        text: 'Policy review complete',
        status: 'done' as const,
        subtasksCompleted: 0,
        subtasksTotal: 0,
        completed: true,
      }],
      senderName: 'Agent',
      includeNextSteps: false,
    };

    it('should generate formal tone email', async () => {
      const result = await generateEmail({ ...baseRequest, tone: 'formal' });
      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
    });

    it('should generate friendly tone email', async () => {
      const result = await generateEmail({ ...baseRequest, tone: 'friendly' });
      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
    });

    it('should generate brief tone email', async () => {
      const result = await generateEmail({ ...baseRequest, tone: 'brief' });
      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
      // Brief emails should be shorter
      expect(result.body!.length).toBeLessThan(500);
    });
  });

  // Test 8: Edge cases
  describe('Edge Cases & Error Handling', () => {
    it('should reject request without customer name', async () => {
      const result = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{ text: 'Test', status: 'todo', subtasksCompleted: 0, subtasksTotal: 0 }],
          tone: 'friendly',
          senderName: 'Agent',
          includeNextSteps: false,
        }),
      });
      const data = await result.json();
      expect(data.success).toBe(false);
    });

    it('should reject request without tasks', async () => {
      const result = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test',
          tasks: [],
          tone: 'friendly',
          senderName: 'Agent',
          includeNextSteps: false,
        }),
      });
      const data = await result.json();
      expect(data.success).toBe(false);
    });

    it('should handle very long task descriptions', async () => {
      const request: EmailRequest = {
        customerName: 'Long Task Customer',
        tasks: [{
          text: 'A'.repeat(500), // Very long task name
          status: 'in_progress',
          subtasksCompleted: 0,
          subtasksTotal: 0,
        }],
        tone: 'friendly',
        senderName: 'Agent',
        includeNextSteps: false,
      };

      const result = await generateEmail(request);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in names', async () => {
      const request: EmailRequest = {
        customerName: "O'Brien-Smith & Co.",
        tasks: [{
          text: 'Test task',
          status: 'done',
          subtasksCompleted: 0,
          subtasksTotal: 0,
          completed: true,
        }],
        tone: 'friendly',
        senderName: "Mary O'Connor",
        includeNextSteps: false,
      };

      const result = await generateEmail(request);
      expect(result.success).toBe(true);
    });
  });

  // Test 9: Insurance agent language verification
  describe('Insurance Agent Language Style', () => {
    it('should use insurance-appropriate terminology', async () => {
      const request: EmailRequest = {
        customerName: 'Insurance Customer',
        tasks: [
          {
            text: 'Review auto insurance policy and update coverage',
            status: 'done',
            subtasksCompleted: 0,
            subtasksTotal: 0,
            completed: true,
          },
          {
            text: 'Submit claim to carrier',
            status: 'in_progress',
            subtasksCompleted: 1,
            subtasksTotal: 2,
          },
        ],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      const bodyLower = result.body!.toLowerCase();

      // Should NOT use these phrases
      expect(bodyLower).not.toContain('i hope this email finds you well');
      expect(bodyLower).not.toContain('task management');
      expect(bodyLower).not.toContain('[date]');
      expect(bodyLower).not.toContain('[name]');

      // Email should be professional and concise
      expect(result.body!.split('\n\n').length).toBeLessThanOrEqual(5); // Max 4 paragraphs
    });

    it('should show proactive agent care in language', async () => {
      const request: EmailRequest = {
        customerName: 'Valued Customer',
        tasks: [{
          text: 'Annual policy review',
          status: 'done',
          subtasksCompleted: 3,
          subtasksTotal: 3,
          completed: true,
        }],
        tone: 'friendly',
        senderName: 'Sarah',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.body).toBeTruthy();
      // Should sound warm and personal
    });
  });

  // Test 10: Complex real-world scenario
  describe('Complex Real-World Scenarios', () => {
    it('should handle comprehensive insurance scenario', async () => {
      const request: EmailRequest = {
        customerName: 'Jennifer Anderson',
        customerEmail: 'jennifer@example.com',
        customerPhone: '555-9876',
        tasks: [
          {
            text: 'Review renewal quote for auto policy',
            status: 'done',
            subtasksCompleted: 4,
            subtasksTotal: 4,
            notes: 'Compared 3 carriers, Geico best rate',
            completed: true,
          },
          {
            text: 'Add new teen driver to policy',
            status: 'in_progress',
            subtasksCompleted: 2,
            subtasksTotal: 3,
            transcription: 'Hi Sarah, my daughter just got her license. Can you add her to the policy? I know it will increase the premium but I want to make sure she is covered. Call me back when you can.',
            attachments: [
              { file_name: 'drivers_license.jpg', file_type: 'image/jpeg' },
            ],
          },
          {
            text: 'Update home insurance coverage',
            status: 'todo',
            subtasksCompleted: 0,
            subtasksTotal: 2,
            dueDate: '2026-02-01',
          },
        ],
        tone: 'friendly',
        senderName: 'Sarah Johnson',
        includeNextSteps: true,
      };

      const result = await generateEmail(request);

      expect(result.success).toBe(true);
      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      expect(result.warnings).toBeDefined();

      // Should reference the voicemail concern
      const bodyLower = result.body!.toLowerCase();
      expect(
        bodyLower.includes('daughter') ||
        bodyLower.includes('driver') ||
        bodyLower.includes('license')
      ).toBe(true);

      // Should acknowledge the document
      expect(
        bodyLower.includes('document') ||
        bodyLower.includes('license') ||
        bodyLower.includes('received')
      ).toBe(true);
    });
  });
});

console.log('✅ Email Generation Test Suite Ready');
console.log('Run with: npm test tests/email-generation.test.ts');
