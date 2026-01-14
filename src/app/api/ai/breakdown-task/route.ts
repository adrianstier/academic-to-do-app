import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Subtask {
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept both 'text' and 'taskText' for compatibility
    const text = body.text || body.taskText;
    const users = body.users;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Task text is required' },
        { status: 400 }
      );
    }

    const userList = Array.isArray(users) && users.length > 0
      ? users.join(', ')
      : 'no team members registered';

    const prompt = `You are a task breakdown assistant for a small business team. Take a task and break it down into actionable subtasks.

Main task: "${text}"

Team members: ${userList}

Analyze the task and break it down into 2-6 specific, actionable subtasks. Each subtask should be:
- A single, concrete action
- Completable in one sitting
- Starting with an action verb

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "subtasks": [
    {
      "text": "Clear, specific action starting with a verb",
      "priority": "low, medium, high, or urgent",
      "estimatedMinutes": estimated time in minutes (5, 10, 15, 30, 60, etc.)
    }
  ],
  "summary": "Brief 1-sentence summary of what completing these subtasks accomplishes"
}

Rules:
- Create 2-6 subtasks depending on task complexity
- Simple tasks might only need 2-3 subtasks
- Complex tasks can have up to 6 subtasks
- Each subtask should be independently completable
- Order subtasks logically (dependencies first)
- Inherit urgency from the main task context
- Keep subtask text under 80 characters
- Don't add unnecessary steps - focus on essential actions

Examples:

Task: "Prepare quarterly report"
{
  "subtasks": [
    { "text": "Gather Q4 sales data from CRM", "priority": "high", "estimatedMinutes": 30 },
    { "text": "Calculate revenue and expense totals", "priority": "high", "estimatedMinutes": 20 },
    { "text": "Create summary charts and graphs", "priority": "medium", "estimatedMinutes": 45 },
    { "text": "Write executive summary section", "priority": "high", "estimatedMinutes": 30 },
    { "text": "Review and proofread final document", "priority": "medium", "estimatedMinutes": 15 }
  ],
  "summary": "Complete quarterly business report ready for stakeholder review"
}

Task: "Call client about project"
{
  "subtasks": [
    { "text": "Review project status and recent updates", "priority": "medium", "estimatedMinutes": 10 },
    { "text": "Prepare list of discussion points", "priority": "medium", "estimatedMinutes": 5 },
    { "text": "Call client and discuss project updates", "priority": "high", "estimatedMinutes": 20 },
    { "text": "Send follow-up email with action items", "priority": "medium", "estimatedMinutes": 10 }
  ],
  "summary": "Client fully updated on project with clear next steps documented"
}

Respond with ONLY the JSON object, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Failed to parse AI response', undefined, { component: 'BreakdownTaskAPI', responseText });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate and clean up the response
    const validatedSubtasks: Subtask[] = (result.subtasks || [])
      .slice(0, 6) // Max 6 subtasks
      .map((subtask: { text?: string; priority?: string; estimatedMinutes?: number }) => ({
        text: String(subtask.text || '').slice(0, 200),
        priority: ['low', 'medium', 'high', 'urgent'].includes(subtask.priority || '')
          ? subtask.priority
          : 'medium',
        estimatedMinutes: typeof subtask.estimatedMinutes === 'number'
          ? Math.min(Math.max(subtask.estimatedMinutes, 5), 480) // 5 min to 8 hours
          : undefined,
      }))
      .filter((subtask: Subtask) => subtask.text.length > 0);

    if (validatedSubtasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not generate subtasks for this task' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subtasks: validatedSubtasks,
      summary: String(result.summary || '').slice(0, 200),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error breaking down task', error, { component: 'BreakdownTaskAPI', details: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to break down task', details: errorMessage },
      { status: 500 }
    );
  }
}
