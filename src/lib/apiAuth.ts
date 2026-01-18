/**
 * API Authentication Helper
 *
 * Provides helper functions for validating user authentication
 * and authorization in API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Todo, Attachment } from '@/types/todo';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Extract userName from request
 * Checks header first, then query params
 */
export function extractUserName(request: NextRequest): string | null {
  // Check header first (X-User-Name)
  const headerUserName = request.headers.get('X-User-Name');
  if (headerUserName && headerUserName.trim()) {
    return headerUserName.trim();
  }

  // Check query params
  const { searchParams } = new URL(request.url);
  const queryUserName = searchParams.get('userName');
  if (queryUserName && queryUserName.trim()) {
    return queryUserName.trim();
  }

  return null;
}

/**
 * Validate that userName is provided and not empty
 * Returns an error response if validation fails, null if valid
 */
export function validateUserName(userName: string | null): NextResponse | null {
  if (!userName) {
    return NextResponse.json(
      { success: false, error: 'userName is required for authentication' },
      { status: 401 }
    );
  }

  if (userName.length < 1 || userName.length > 100) {
    return NextResponse.json(
      { success: false, error: 'Invalid userName' },
      { status: 400 }
    );
  }

  return null;
}

/**
 * Verify that a user can access a specific todo
 * Returns the todo if access is granted, or an error response
 */
export async function verifyTodoAccess(
  todoId: string,
  userName: string
): Promise<{ todo: Todo; error: null } | { todo: null; error: NextResponse }> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: todo, error: fetchError } = await supabase
    .from('todos')
    .select('*')
    .eq('id', todoId)
    .single();

  if (fetchError || !todo) {
    return {
      todo: null,
      error: NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      ),
    };
  }

  // Access control: user can access if they:
  // 1. Created the todo
  // 2. Are assigned to the todo
  // 3. Updated the todo (had previous access)
  const hasAccess =
    todo.created_by === userName ||
    todo.assigned_to === userName ||
    todo.updated_by === userName;

  if (!hasAccess) {
    return {
      todo: null,
      error: NextResponse.json(
        { success: false, error: 'Access denied: you do not have permission to access this todo' },
        { status: 403 }
      ),
    };
  }

  return { todo: todo as Todo, error: null };
}

/**
 * Verify that a user can access an attachment through the owning todo
 * Returns the todo and attachment if access is granted
 */
export async function verifyAttachmentAccess(
  todoId: string,
  attachmentId: string,
  userName: string
): Promise<
  | { todo: Todo; attachment: Attachment; error: null }
  | { todo: null; attachment: null; error: NextResponse }
> {
  // First verify todo access
  const { todo, error: todoError } = await verifyTodoAccess(todoId, userName);
  if (todoError) {
    return { todo: null, attachment: null, error: todoError };
  }

  // Find the attachment in the todo
  const attachments = (todo.attachments || []) as Attachment[];
  const attachment = attachments.find((a) => a.id === attachmentId);

  if (!attachment) {
    return {
      todo: null,
      attachment: null,
      error: NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      ),
    };
  }

  return { todo, attachment, error: null };
}

/**
 * Extract todoId from storage path
 * Storage paths are in format: {todoId}/{attachmentId}.{ext}
 */
export function extractTodoIdFromPath(storagePath: string): string | null {
  const parts = storagePath.split('/');
  if (parts.length >= 1) {
    return parts[0];
  }
  return null;
}
