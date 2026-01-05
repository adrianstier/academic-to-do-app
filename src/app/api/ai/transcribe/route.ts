import { NextRequest, NextResponse } from 'next/server';

// Audio file transcription endpoint using OpenAI Whisper + Claude for task parsing
// Supports three modes:
// 1. Transcription only (default): Just returns the text from Whisper
// 2. Tasks mode: If 'users' is provided, transcribes then extracts tasks with Claude
// 3. Subtasks mode: If 'mode=subtasks' is provided, extracts subtasks for a parent task
// The live microphone feature uses the browser's built-in Web Speech API and doesn't need this endpoint.

// Supported audio formats by Whisper
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg', 'aac', 'flac'];

type ProcessingMode = 'transcribe' | 'tasks' | 'subtasks';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const usersJson = formData.get('users') as string | null;
    let users: string[] = [];
    if (usersJson) {
      try {
        const parsed = JSON.parse(usersJson);
        users = Array.isArray(parsed) ? parsed : [];
      } catch {
        console.warn('Failed to parse users JSON, using empty array');
      }
    }
    const modeParam = formData.get('mode') as string | null;
    const parentTaskText = formData.get('parentTaskText') as string | null;

    // Determine processing mode
    let mode: ProcessingMode = 'transcribe';
    if (modeParam === 'subtasks') {
      mode = 'subtasks';
    } else if (users.length > 0 || formData.has('parseTasks')) {
      mode = 'tasks';
    }

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('Received audio file:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
      mode,
    });

    // Check file size (limit to 25MB for consistency, though Claude supports up to 100MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    // Check file format
    const extension = audioFile.name.split('.').pop()?.toLowerCase();
    if (extension && !SUPPORTED_FORMATS.includes(extension)) {
      return NextResponse.json(
        { success: false, error: `Unsupported audio format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json({
        success: false,
        error: 'Audio transcription requires OpenAI API key. Please add OPENAI_API_KEY to your environment variables.',
      }, { status: 501 });
    }

    // Step 1: Transcribe audio using OpenAI Whisper
    console.log('Sending to OpenAI Whisper for transcription...');

    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('response_format', 'text');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({}));
      console.error('Whisper API error:', whisperResponse.status, errorData);
      return NextResponse.json({
        success: false,
        error: errorData?.error?.message || 'Failed to transcribe audio',
      }, { status: whisperResponse.status });
    }

    const transcription = await whisperResponse.text();
    console.log('Transcription successful, length:', transcription.length);

    // For simple transcription mode, return here
    if (mode === 'transcribe') {
      return NextResponse.json({
        success: true,
        text: transcription.trim(),
      });
    }

    // Step 2: Use Claude to extract tasks from the transcription
    if (!process.env.ANTHROPIC_API_KEY) {
      // If no Claude API key, return just the transcription
      console.log('ANTHROPIC_API_KEY not configured, returning transcription only');
      return NextResponse.json({
        success: true,
        text: transcription.trim(),
        tasks: mode === 'tasks' ? [{
          text: transcription.trim().slice(0, 200),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        }] : undefined,
        subtasks: mode === 'subtasks' ? [{
          text: transcription.trim().slice(0, 200),
          priority: 'medium',
        }] : undefined,
      });
    }

    // Build the prompt based on mode
    const today = new Date().toISOString().split('T')[0];
    const userList = users.length > 0 ? users.join(', ') : 'none specified';

    let prompt: string;

    if (mode === 'tasks') {
      prompt = `Analyze this voicemail transcription and extract ALL distinct action items or tasks mentioned.

TRANSCRIPTION:
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
Leave assignedTo as empty string "" if no person is mentioned.`;
    } else {
      prompt = `Analyze this audio transcription and extract ALL distinct action items as subtasks.

TRANSCRIPTION:
"${transcription}"

${parentTaskText ? `Parent task context: "${parentTaskText}"` : ''}
Today's date: ${today}

Extract actionable items from this transcription as subtasks. Look for:
- Explicit requests or instructions
- Questions that need answers (turn into "Respond to..." tasks)
- Deadlines or follow-ups mentioned
- Items to review, send, call, schedule, prepare, etc.
- Any commitments or promises made

For each subtask provide:
1. A clear, actionable description (start with action verb: Review, Call, Send, Schedule, Prepare, Follow up, etc.)
2. Priority (low, medium, high, urgent) - infer from language urgency
3. Estimated minutes to complete (5, 10, 15, 30, 45, 60, 90, 120)

Respond ONLY with valid JSON in this exact format:
{
  "subtasks": [
    {
      "text": "Action item description",
      "priority": "medium",
      "estimatedMinutes": 15
    }
  ],
  "summary": "Brief summary of what this audio is about"
}

Rules:
- Extract 2-10 subtasks depending on content complexity
- Each subtask should be independently completable
- Keep subtask text under 100 characters
- Order by logical sequence or priority
- If content mentions specific deadlines, note urgency in priority
- Don't create redundant or overly granular subtasks`;
    }

    // Use Claude to extract tasks from the transcription
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.json().catch(() => ({}));
      console.error('Claude API error:', claudeResponse.status, errorData);

      // Still return the transcription even if Claude fails
      return NextResponse.json({
        success: true,
        text: transcription.trim(),
        tasks: mode === 'tasks' ? [{
          text: transcription.trim().slice(0, 200),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        }] : undefined,
        subtasks: mode === 'subtasks' ? [{
          text: transcription.trim().slice(0, 200),
          priority: 'medium',
        }] : undefined,
      });
    }

    const data = await claudeResponse.json();
    const responseText = data.content?.[0]?.type === 'text' ? data.content[0].text : '';

    // Handle tasks mode
    if (mode === 'tasks') {
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          const tasks = (parsed.tasks || []).map((task: {
            text?: string;
            priority?: string;
            dueDate?: string;
            assignedTo?: string;
          }) => ({
            text: task.text || transcription.trim().slice(0, 200),
            priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority || '')
              ? task.priority
              : 'medium',
            dueDate: task.dueDate || '',
            assignedTo: task.assignedTo || '',
          }));

          console.log('Task extraction successful:', tasks.length, 'tasks found');

          return NextResponse.json({
            success: true,
            text: transcription.trim(),
            tasks,
          });
        }
      } catch (parseError) {
        console.error('Failed to parse task JSON:', parseError);
      }

      // Fallback: return transcription as single task
      return NextResponse.json({
        success: true,
        text: transcription.trim(),
        tasks: [{
          text: transcription.trim().slice(0, 200),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        }],
      });
    }

    // Handle subtasks mode
    if (mode === 'subtasks') {
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          const subtasks = (parsed.subtasks || [])
            .slice(0, 10)
            .map((subtask: {
              text?: string;
              priority?: string;
              estimatedMinutes?: number;
            }) => ({
              text: String(subtask.text || '').slice(0, 200),
              priority: ['low', 'medium', 'high', 'urgent'].includes(subtask.priority || '')
                ? subtask.priority
                : 'medium',
              estimatedMinutes: typeof subtask.estimatedMinutes === 'number'
                ? Math.min(Math.max(subtask.estimatedMinutes, 5), 480)
                : undefined,
            }))
            .filter((subtask: { text: string }) => subtask.text.length > 0);

          console.log('Subtask extraction successful:', subtasks.length, 'subtasks found');

          return NextResponse.json({
            success: true,
            text: transcription.trim(),
            subtasks,
            summary: String(parsed.summary || '').slice(0, 300),
          });
        }
      } catch (parseError) {
        console.error('Failed to parse subtask JSON:', parseError);
      }

      // Fallback: return transcription as single subtask
      return NextResponse.json({
        success: true,
        text: transcription.trim(),
        subtasks: [{
          text: transcription.trim().slice(0, 200),
          priority: 'medium',
        }],
        summary: '',
      });
    }

    // Shouldn't reach here, but return transcription just in case
    return NextResponse.json({
      success: true,
      text: transcription.trim(),
    });

  } catch (error) {
    console.error('Transcription error:', error);

    // Check for specific Claude API errors
    if (error instanceof Error) {
      if (error.message.includes('Could not process audio')) {
        return NextResponse.json({
          success: false,
          error: 'Could not process this audio file. Please try a different format or file.',
        }, { status: 400 });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to process audio file. Please try again.' },
      { status: 500 }
    );
  }
}
