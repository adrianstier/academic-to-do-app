import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    const { text, assignedTo, priority, dueDate, createdBy } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Task text is required' },
        { status: 400 }
      );
    }

    const taskId = uuidv4();
    const now = new Date().toISOString();

    // Build the task object
    const task: Record<string, unknown> = {
      id: taskId,
      text: text.trim(),
      completed: false,
      status: 'todo',
      created_at: now,
      created_by: createdBy || 'Outlook Add-in',
    };

    // Add optional fields
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      task.priority = priority;
    }

    if (assignedTo && assignedTo.trim()) {
      task.assigned_to = assignedTo.trim();
    }

    if (dueDate) {
      // Ensure date is in proper format
      task.due_date = dueDate;
    }

    // Insert into Supabase
    const { error: insertError } = await supabase
      .from('todos')
      .insert([task]);

    if (insertError) {
      logger.error('Error inserting task', insertError, { component: 'OutlookCreateTaskAPI' });
      return NextResponse.json(
        { success: false, error: 'Failed to create task in database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Task created successfully',
    });
  } catch (error) {
    logger.error('Error creating task', error, { component: 'OutlookCreateTaskAPI' });
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
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
