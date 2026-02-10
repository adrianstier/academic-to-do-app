/**
 * Tag Detail API - Delete
 *
 * DELETE /api/tags/[id] - Delete a tag (cascades to todo_tags)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Extract tag ID from the URL path
 */
function getTagIdFromUrl(request: NextRequest): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // URL pattern: /api/tags/[id]
  const tagsIndex = segments.indexOf('tags');
  if (tagsIndex !== -1 && segments.length > tagsIndex + 1) {
    return segments[tagsIndex + 1];
  }
  return null;
}

/**
 * DELETE /api/tags/[id] - Delete a tag
 *
 * This cascades to todo_tags (via ON DELETE CASCADE in the schema).
 */
export const DELETE = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const tagId = getTagIdFromUrl(request);

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Verify the tag belongs to this team before deleting
    let verifyQuery = supabase
      .from('tags')
      .select('id, name')
      .eq('id', tagId);

    if (context.teamId && context.teamId.trim() !== '') {
      verifyQuery = verifyQuery.eq('team_id', context.teamId);
    }

    const { data: tag, error: verifyError } = await verifyQuery.single();

    if (verifyError || !tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Delete the tag (todo_tags will cascade)
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) throw error;

    logger.info('Tag deleted', {
      component: 'api/tags/[id]',
      action: 'DELETE',
      tagId,
      tagName: tag.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting tag', error as Error, {
      component: 'api/tags/[id]',
      action: 'DELETE',
    });
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
});
