import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { analyzeTaskPattern, getAllPatternDefinitions, getCompletionRateWarning } from '@/lib/academicPatterns';
import { withTeamAuth } from '@/lib/teamAuth';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Subtask {
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes?: number;
}

export const POST = withTeamAuth(async (request, context) => {
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

    // Analyze task pattern for academic-specific context
    const patternMatch = analyzeTaskPattern(text);
    const academicContext = patternMatch
      ? `\nDetected task category: ${patternMatch.category.toUpperCase()} (${Math.round(patternMatch.confidence * 100)}% confidence)
Suggested subtasks for this category:
${patternMatch.suggestedSubtasks.map((s, i) => `- ${s} (~${patternMatch.estimatedMinutes[i]} min)`).join('\n')}
${patternMatch.tips ? `\nTip: ${patternMatch.tips}` : ''}`
      : '';

    const userList = Array.isArray(users) && users.length > 0
      ? users.join(', ')
      : 'no team members registered';

    // Get completion rate warning if applicable
    const completionWarning = patternMatch ? getCompletionRateWarning(patternMatch.category) : null;

    const prompt = `You are a task breakdown assistant for academic research and coursework. Take a task and break it down into actionable subtasks.

Main task: "${text}"
${academicContext}

Team members: ${userList}

ACADEMIC CONTEXT:
You're helping with academic research and coursework. Common task types and their typical subtasks:

${getAllPatternDefinitions()}

Analyze the task and break it down into 2-6 specific, actionable subtasks. Each subtask should be:
- A single, concrete action
- Completable in one sitting
- Starting with an action verb
- Relevant to academic/research workflows

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "subtasks": [
    {
      "text": "Clear, specific action starting with a verb",
      "priority": "low, medium, high, or urgent",
      "estimatedMinutes": estimated time in minutes (5, 10, 15, 30, 60, etc.)
    }
  ],
  "summary": "Brief 1-sentence summary of what completing these subtasks accomplishes",
  "category": "detected category name or null"
}

Rules:
- Create 2-6 subtasks depending on task complexity
- Use the detected category's suggested subtasks as a starting point, but customize for the specific task
- Simple tasks might only need 2-3 subtasks
- Complex tasks can have up to 6 subtasks
- Each subtask should be independently completable
- Order subtasks logically (dependencies first)
- Inherit urgency from the main task context
- Keep subtask text under 80 characters
- Don't add unnecessary steps - focus on essential actions
- For academic tasks, include documentation and reference management steps

Academic-specific examples:

Task: "Literature review for thesis chapter 2"
{
  "subtasks": [
    { "text": "Search databases for relevant papers (2015-2024)", "priority": "high", "estimatedMinutes": 45 },
    { "text": "Read and annotate top 15-20 papers", "priority": "high", "estimatedMinutes": 120 },
    { "text": "Identify key themes and research gaps", "priority": "medium", "estimatedMinutes": 30 },
    { "text": "Write synthesis summary with citations", "priority": "medium", "estimatedMinutes": 60 }
  ],
  "summary": "Complete literature review establishing theoretical foundation for chapter 2",
  "category": "research"
}

Task: "Prepare conference presentation"
{
  "subtasks": [
    { "text": "Create slide deck with key findings", "priority": "high", "estimatedMinutes": 90 },
    { "text": "Write speaker notes for each slide", "priority": "medium", "estimatedMinutes": 30 },
    { "text": "Practice presentation and time it", "priority": "high", "estimatedMinutes": 45 },
    { "text": "Get feedback from advisor and revise", "priority": "medium", "estimatedMinutes": 30 }
  ],
  "summary": "Polished conference presentation ready for delivery",
  "category": "presentation"
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

    // Build response with pattern analysis info
    const response: {
      success: boolean;
      subtasks: Subtask[];
      summary: string;
      category?: string;
      confidence?: number;
      tips?: string;
      completionWarning?: string;
    } = {
      success: true,
      subtasks: validatedSubtasks,
      summary: String(result.summary || '').slice(0, 200),
    };

    // Add pattern analysis info if available
    if (patternMatch) {
      response.category = patternMatch.category;
      response.confidence = Math.round(patternMatch.confidence * 100);
      if (patternMatch.tips) {
        response.tips = patternMatch.tips;
      }
      if (completionWarning) {
        response.completionWarning = completionWarning;
      }
    } else if (result.category) {
      response.category = String(result.category);
    }

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error breaking down task', error, { component: 'BreakdownTaskAPI', details: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to break down task', details: errorMessage },
      { status: 500 }
    );
  }
});
