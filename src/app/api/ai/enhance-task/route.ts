import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { withTeamAuth } from '@/lib/teamAuth';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const POST = withTeamAuth(async (request, context) => {
  try {
    const { text, users } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Task text is required' },
        { status: 400 }
      );
    }

    const userList = Array.isArray(users) && users.length > 0
      ? users.join(', ')
      : 'no team members registered';

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const prompt = `You are a task enhancement assistant for a small business team. Take the user's task input and improve it.

User's task input: "${text}"

Today's date: ${today} (${dayOfWeek})
Team members: ${userList}

Analyze the input and respond ONLY with valid JSON (no markdown, no code blocks):
{
  "text": "A clear, concise, action-oriented task description. Start with a verb (Review, Send, Call, Schedule, Complete, etc.). Fix spelling/grammar. Make vague tasks specific if possible.",
  "priority": "low, medium, high, or urgent - based on urgency words in the input",
  "dueDate": "YYYY-MM-DD format if a deadline is mentioned or implied, otherwise empty string",
  "assignedTo": "Name of team member if mentioned or clearly implied, otherwise empty string",
  "wasEnhanced": true or false - whether any meaningful changes were made
}

Rules:
- PRESERVE the original intent - don't add tasks the user didn't mention
- If input is already clear and specific, keep it mostly as-is (set wasEnhanced to false)
- Fix obvious typos and grammar issues
- Parse relative dates: "tomorrow", "next week", "by Friday", "end of month", "in 3 days"
- Detect urgency: "ASAP", "urgent", "immediately", "critical" = urgent priority
- Detect high priority: "important", "priority", "soon" = high priority
- If no urgency mentioned, default to medium priority
- Only suggest assignee if a team member name is explicitly mentioned in the input
- Keep tasks concise (under 100 characters when possible)

Examples:
- "call john tmrw" -> { "text": "Call John", "dueDate": "2024-01-16", "priority": "medium", "assignedTo": "", "wasEnhanced": true }
- "ASAP review budget" -> { "text": "Review budget", "priority": "urgent", "dueDate": "", "assignedTo": "", "wasEnhanced": true }
- "have sefra check invoices by friday" -> { "text": "Check invoices", "priority": "medium", "dueDate": "2024-01-19", "assignedTo": "Sefra", "wasEnhanced": true }
- "Send email to client" -> { "text": "Send email to client", "priority": "medium", "dueDate": "", "assignedTo": "", "wasEnhanced": false }

Respond with ONLY the JSON object, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Failed to parse AI response', undefined, { component: 'EnhanceTaskAPI', responseText });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const enhanced = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    const validatedResult = {
      text: enhanced.text || text,
      priority: ['low', 'medium', 'high', 'urgent'].includes(enhanced.priority)
        ? enhanced.priority
        : 'medium',
      dueDate: enhanced.dueDate || '',
      assignedTo: enhanced.assignedTo || '',
      wasEnhanced: Boolean(enhanced.wasEnhanced),
    };

    return NextResponse.json({
      success: true,
      enhanced: validatedResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error enhancing task', error, { component: 'EnhanceTaskAPI', details: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to enhance task', details: errorMessage },
      { status: 500 }
    );
  }
});
