import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { withTeamAuth } from '@/lib/teamAuth';

export interface ParsedSubtask {
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes?: number;
}

export const POST = withTeamAuth(async (request, context) => {
  try {
    const { content, contentType, parentTaskText } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    if (content.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Content is too short to parse into subtasks' },
        { status: 400 }
      );
    }

    // If no API key, return a simple fallback
    if (!process.env.ANTHROPIC_API_KEY) {
      // Split by sentences/newlines as fallback
      const lines = content
        .split(/[.\n]+/)
        .map(line => line.trim())
        .filter(line => line.length > 5 && line.length < 200);

      const fallbackSubtasks: ParsedSubtask[] = lines.slice(0, 8).map(line => ({
        text: line,
        priority: 'medium' as const,
      }));

      return NextResponse.json({
        success: true,
        subtasks: fallbackSubtasks.length > 0 ? fallbackSubtasks : [{
          text: content.slice(0, 200),
          priority: 'medium' as const,
        }],
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const today = new Date().toISOString().split('T')[0];
    const contentTypeLabel = contentType === 'email' ? 'email' : contentType === 'voicemail' ? 'voicemail transcription' : 'message';

    const prompt = `You are a task extraction assistant. Analyze this ${contentTypeLabel} and extract ALL distinct action items as subtasks for a parent task.

${parentTaskText ? `Parent task context: "${parentTaskText}"` : ''}

${contentTypeLabel.charAt(0).toUpperCase() + contentTypeLabel.slice(1)} content:
"""
${content}
"""

Today's date: ${today}

Extract actionable items from this content as subtasks. Look for:
- Explicit requests or instructions
- Questions that need answers (turn into "Respond to..." tasks)
- Deadlines or follow-ups mentioned
- Items to review, send, call, schedule, prepare, etc.
- Any commitments or promises made

For each subtask provide:
1. A clear, actionable description (start with action verb: Review, Call, Send, Schedule, Prepare, Follow up, etc.)
2. Priority (low, medium, high, urgent) - infer from language urgency
3. Estimated minutes to complete (5, 10, 15, 30, 45, 60, 90, 120)

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "subtasks": [
    {
      "text": "Action item description",
      "priority": "medium",
      "estimatedMinutes": 15
    }
  ],
  "summary": "Brief summary of what this content is about"
}

Rules:
- Extract 2-10 subtasks depending on content complexity
- Each subtask should be independently completable
- Keep subtask text under 100 characters
- Order by logical sequence or priority
- If the content mentions specific deadlines, note urgency in priority
- Don't create redundant or overly granular subtasks
- If content is conversational, focus on action items, not statements

Respond with ONLY the JSON object.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Failed to parse AI response', undefined, { component: 'ParseContentToSubtasksAPI', responseText });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate and clean up the response
    const validatedSubtasks: ParsedSubtask[] = (result.subtasks || [])
      .slice(0, 10) // Max 10 subtasks
      .map((subtask: { text?: string; priority?: string; estimatedMinutes?: number }) => ({
        text: String(subtask.text || '').slice(0, 200),
        priority: ['low', 'medium', 'high', 'urgent'].includes(subtask.priority || '')
          ? subtask.priority as ParsedSubtask['priority']
          : 'medium',
        estimatedMinutes: typeof subtask.estimatedMinutes === 'number'
          ? Math.min(Math.max(subtask.estimatedMinutes, 5), 480)
          : undefined,
      }))
      .filter((subtask: ParsedSubtask) => subtask.text.length > 0);

    if (validatedSubtasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not extract any action items from this content' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subtasks: validatedSubtasks,
      summary: String(result.summary || '').slice(0, 300),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error parsing content to subtasks', error, { component: 'ParseContentToSubtasksAPI', details: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to parse content', details: errorMessage },
      { status: 500 }
    );
  }
});
