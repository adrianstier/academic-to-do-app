/**
 * Process Reminders API
 *
 * Endpoint to process and send due reminders.
 * Can be called by a cron job or external scheduler.
 *
 * Protected by API key authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAllDueReminders } from '@/lib/reminderService';

// Use the same API key as Outlook add-in for simplicity
const API_KEY = process.env.OUTLOOK_ADDON_API_KEY;

/**
 * POST /api/reminders/process
 *
 * Process all due reminders and send notifications.
 * Requires X-API-Key header for authentication.
 */
export async function POST(request: NextRequest) {
  // Authenticate with API key
  const apiKey = request.headers.get('X-API-Key');

  if (!API_KEY || apiKey !== API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await processAllDueReminders();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error processing reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process reminders' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reminders/process
 *
 * Health check endpoint for the reminder processor.
 * Returns the count of pending reminders.
 */
export async function GET(request: NextRequest) {
  // Authenticate with API key
  const apiKey = request.headers.get('X-API-Key');

  if (!API_KEY || apiKey !== API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Import here to avoid circular dependency issues
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Count pending reminders
    const { count: pendingCount } = await supabase
      .from('task_reminders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Count reminders due in next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { count: dueCount } = await supabase
      .from('task_reminders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('reminder_time', fiveMinutesFromNow);

    return NextResponse.json({
      success: true,
      status: 'healthy',
      pendingReminders: pendingCount || 0,
      remindersDueSoon: dueCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking reminder status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check reminder status' },
      { status: 500 }
    );
  }
}
