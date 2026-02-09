import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

/**
 * POST /api/patterns/analyze
 *
 * Analyzes completed tasks from the last 90 days to identify patterns
 * and update the task_patterns table for smart suggestions.
 */
export const POST = withTeamAuth(async (_request: NextRequest, context: TeamAuthContext) => {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    if (!anthropicKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    // Fetch completed tasks from last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('todos')
      .select('*')
      .eq('completed', true)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(500);

    if (context.teamId) {
      query = query.eq('team_id', context.teamId);
    }

    const { data: completedTasks, error: fetchError } = await query;

    if (fetchError) {
      console.error('Failed to fetch completed tasks:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    if (!completedTasks || completedTasks.length < 10) {
      return NextResponse.json({
        success: true,
        message: 'Not enough completed tasks to analyze',
        patternsFound: 0,
      });
    }

    // Use Claude to analyze and categorize tasks
    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    const taskSummary = completedTasks
      .slice(0, 200) // Limit for context window
      .map(t => {
        const subtaskCount = t.subtasks?.length || 0;
        return `- ${t.text} (priority: ${t.priority}, subtasks: ${subtaskCount})`;
      })
      .join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze these academic research team tasks and identify common patterns.

Tasks:
${taskSummary}

Categorize into these academic-specific categories:
- research: Data collection, experiments, analysis
- writing: Manuscripts, drafts, revisions, submissions
- meeting: Advisor meetings, lab meetings, seminars, committees
- teaching: Course prep, grading, office hours, student advising
- deadline: Conference submissions, grant applications, journal deadlines
- literature: Literature reviews, reading papers, citations
- collaboration: Collaborator coordination, co-author communication
- admin: Administrative tasks, IRB, travel, reimbursements
- follow_up: General follow-ups
- other: Miscellaneous

Return a JSON object with this exact structure (no markdown, just JSON):
{
  "patterns": [
    {
      "category": "category_name",
      "pattern_text": "normalized task description (short, general)",
      "occurrence_count": number,
      "avg_priority": "low|medium|high|urgent",
      "suggested_subtasks": ["subtask1", "subtask2", "subtask3"]
    }
  ]
}

Group similar tasks together and extract common subtask patterns. Only include patterns that appear at least 3 times.`,
        },
      ],
    });

    // Extract and parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Try to parse JSON from response
    let patterns;
    try {
      // Clean up response if it has markdown code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        patterns = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI analysis' },
        { status: 500 }
      );
    }

    // Upsert patterns into database
    let upsertedCount = 0;
    for (const pattern of patterns.patterns || []) {
      const { error: upsertError } = await supabase
        .from('task_patterns')
        .upsert(
          {
            pattern_text: pattern.pattern_text,
            category: pattern.category,
            occurrence_count: pattern.occurrence_count,
            avg_priority: pattern.avg_priority,
            common_subtasks: pattern.suggested_subtasks,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'pattern_text',
          }
        );

      if (!upsertError) {
        upsertedCount++;
      } else {
        console.error('Failed to upsert pattern:', upsertError);
      }
    }

    return NextResponse.json({
      success: true,
      patternsFound: patterns.patterns?.length || 0,
      patternsUpserted: upsertedCount,
      tasksAnalyzed: completedTasks.length,
    });
  } catch (error) {
    console.error('Pattern analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
