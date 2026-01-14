import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Verify API key middleware
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === process.env.OUTLOOK_ADDON_API_KEY;
}

export async function POST(request: NextRequest) {
  // Verify API key
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { subject, body, sender, receivedDate } = await request.json();

    if (!subject && !body) {
      return NextResponse.json(
        { success: false, error: 'Email subject or body is required' },
        { status: 400 }
      );
    }

    const prompt = `You are a task extraction assistant for a small business. Analyze this email and extract a clear, actionable task.

Email Subject: ${subject || '(no subject)'}
Email Body: ${body || '(no body)'}
From: ${sender || 'unknown'}
Received: ${receivedDate || 'unknown'}

Extract the following information and respond ONLY with valid JSON (no markdown, no code blocks):
{
  "text": "A clear, concise task description (action-oriented, start with a verb like Review, Send, Call, Schedule, etc.)",
  "suggestedAssignee": "Name of person who should do this task if mentioned (e.g., 'Sefra', 'Derek'), or empty string if not specified",
  "priority": "low, medium, high, or urgent based on urgency indicators in the email",
  "dueDate": "YYYY-MM-DD format if a deadline is mentioned, or empty string if not specified",
  "context": "Brief note about the email source (e.g., 'Email from John Smith regarding Q4 Budget')"
}

Rules:
- Task text should be clear, actionable, and start with a verb
- Look for names mentioned as assignees (e.g., "have Sefra do...", "ask Derek to...", "please tell X to...")
- Look for deadline words: "by Friday", "by end of day", "by December 15", "ASAP", "urgent", "immediately"
- If ASAP, urgent, or immediately is mentioned, set priority to "urgent"
- If a specific date is mentioned, parse it to YYYY-MM-DD format
- If "by Friday" or similar relative date, calculate the actual date from today (${new Date().toISOString().split('T')[0]})
- Keep the context brief (under 50 words)

Respond with ONLY the JSON object, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Failed to parse AI response', undefined, { component: 'OutlookParseEmailAPI', responseText });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const draft = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    const validatedDraft = {
      text: draft.text || 'Review email and take action',
      suggestedAssignee: draft.suggestedAssignee || '',
      priority: ['low', 'medium', 'high', 'urgent'].includes(draft.priority) ? draft.priority : 'medium',
      dueDate: draft.dueDate || '',
      context: draft.context || `From email by ${sender || 'unknown sender'}`,
    };

    return NextResponse.json({
      success: true,
      draft: validatedDraft,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error parsing email', error, { component: 'OutlookParseEmailAPI', details: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to parse email', details: errorMessage },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}
