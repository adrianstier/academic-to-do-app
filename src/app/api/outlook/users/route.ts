import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

export async function GET(request: NextRequest) {
  // Verify API key
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Fetch registered users
    const { data: registeredUsers, error: usersError } = await supabase
      .from('users')
      .select('name')
      .order('name');

    if (usersError) {
      logger.error('Error fetching users', usersError, { component: 'OutlookUsersAPI' });
    }

    // Also get unique users from todos (for backwards compatibility)
    const { data: todos, error: todosError } = await supabase
      .from('todos')
      .select('created_by, assigned_to');

    if (todosError) {
      logger.error('Error fetching todos', todosError, { component: 'OutlookUsersAPI' });
    }

    // Combine all user names
    const userNames = new Set<string>();

    // Add registered users
    (registeredUsers || []).forEach((u: { name: string }) => {
      if (u.name) userNames.add(u.name);
    });

    // Add users from todos
    (todos || []).forEach((t: { created_by?: string; assigned_to?: string }) => {
      if (t.created_by) userNames.add(t.created_by);
      if (t.assigned_to) userNames.add(t.assigned_to);
    });

    // Convert to sorted array
    const users = Array.from(userNames).sort();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    logger.error('Error fetching users', error, { component: 'OutlookUsersAPI' });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}
