import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

// Parse voicemail transcription to extract multiple tasks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, users } = body;

    if (!transcription || typeof transcription !== 'string') {
      return NextResponse.json(
        { success: false, error: 'No transcription provided' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Return the transcription as a single task if no AI available
      return NextResponse.json({
        success: true,
        tasks: [{
          text: transcription.trim(),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        }],
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userList = users && users.length > 0 ? users.join(', ') : 'none specified';
    const today = new Date().toISOString().split('T')[0];

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a task extraction assistant. Analyze this voicemail transcription and extract ALL distinct action items or tasks mentioned.

Voicemail transcription:
"${transcription}"

Available team members: ${userList}
Today's date: ${today}

For each task found, provide:
1. A clear, actionable task description (clean up the language, make it professional)
2. Priority level (low, medium, high, urgent) - infer from context and urgency words
3. Due date if mentioned (YYYY-MM-DD format) - interpret phrases like "by Friday", "next week", "tomorrow", "end of month"
4. Suggested assignee from the team list if mentioned or implied

IMPORTANT: Extract ALL separate tasks. A single voicemail might contain multiple unrelated action items.

Respond ONLY with valid JSON in this exact format:
{
  "tasks": [
    {
      "text": "Task description here",
      "priority": "medium",
      "dueDate": "2024-01-15",
      "assignedTo": "Person Name"
    }
  ]
}

If the transcription doesn't contain any clear tasks, still return one task with the cleaned-up text.
Leave dueDate as empty string "" if no date is mentioned.
Leave assignedTo as empty string "" if no person is mentioned.`,
        },
      ],
    });

    // Extract text from the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Try to parse JSON from response
    let parsedResponse;
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // If parsing fails, return the transcription as a single task
      return NextResponse.json({
        success: true,
        tasks: [{
          text: transcription.trim(),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        }],
      });
    }

    // Validate the response structure
    if (!parsedResponse.tasks || !Array.isArray(parsedResponse.tasks)) {
      return NextResponse.json({
        success: true,
        tasks: [{
          text: transcription.trim(),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        }],
      });
    }

    // Validate each task and ensure proper structure
    const validatedTasks = parsedResponse.tasks.map((task: {
      text?: string;
      priority?: string;
      dueDate?: string;
      assignedTo?: string;
    }) => ({
      text: task.text || transcription.trim(),
      priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority || '')
        ? task.priority
        : 'medium',
      dueDate: task.dueDate || '',
      assignedTo: task.assignedTo || '',
    }));

    return NextResponse.json({
      success: true,
      tasks: validatedTasks,
    });

  } catch (error) {
    logger.error('Voicemail parsing error', error, { component: 'ParseVoicemailAPI' });
    return NextResponse.json(
      { success: false, error: 'Failed to parse voicemail' },
      { status: 500 }
    );
  }
}
