import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/patterns/suggestions
 *
 * Returns task patterns grouped by category for quick task buttons.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Return empty patterns if not configured
      return NextResponse.json({
        patterns: {},
        total: 0,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: patterns, error } = await supabase
      .from('task_patterns')
      .select('*')
      .order('occurrence_count', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch patterns:', error);
      return NextResponse.json({
        patterns: {},
        total: 0,
      });
    }

    // Group patterns by category
    const grouped = (patterns || []).reduce(
      (acc: Record<string, typeof patterns>, pattern) => {
        const category = pattern.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(pattern);
        return acc;
      },
      {}
    );

    return NextResponse.json({
      patterns: grouped,
      total: patterns?.length || 0,
    });
  } catch (error) {
    console.error('Pattern suggestions error:', error);
    return NextResponse.json({
      patterns: {},
      total: 0,
    });
  }
}
