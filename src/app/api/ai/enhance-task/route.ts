import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { withTeamAuth } from '@/lib/teamAuth';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const POST = withTeamAuth(async (request, context) => {
  try {
    const { text, users } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Task text is required' },
        { status: 400 }
      );
    }

    const userList = Array.isArray(users) && users.length > 0
      ? users.join(', ')
      : 'no team members registered';

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const prompt = `You are a task enhancement assistant for an academic research team. Take the user's task input and improve it.

User's task input: "${text}"

Today's date: ${today} (${dayOfWeek})
Team members: ${userList}

ACADEMIC CONTEXT:
You're helping researchers, PIs, postdocs, grad students, and RAs manage academic tasks. Common task types include:
- Research: experiments, data collection, fieldwork, lab work
- Writing: manuscripts, grant proposals, thesis chapters, abstracts
- Analysis: statistical analysis, data visualization, coding
- Submissions: journal submissions, conference abstracts, grant applications
- Meetings: advisor meetings, lab meetings, committee meetings, seminars
- Teaching: lecture prep, grading, office hours, student advising
- Literature: reading papers, literature reviews, annotating articles
- Admin: IRB submissions, travel arrangements, equipment orders, field permits

Analyze the input and respond ONLY with valid JSON (no markdown, no code blocks):
{
  "text": "A clear, concise, action-oriented task description. Start with a verb (Review, Draft, Analyze, Submit, Schedule, Revise, etc.). Fix spelling/grammar. Make vague tasks specific if possible.",
  "priority": "low, medium, high, or urgent - based on urgency words in the input",
  "dueDate": "YYYY-MM-DD format if a deadline is mentioned or implied, otherwise empty string",
  "assignedTo": "Name of team member if mentioned or clearly implied, otherwise empty string",
  "wasEnhanced": true or false - whether any meaningful changes were made
}

Rules:
- PRESERVE the original intent - don't add tasks the user didn't mention
- If input is already clear and specific, keep it mostly as-is (set wasEnhanced to false)
- Fix obvious typos and grammar issues
- Parse relative dates: "tomorrow", "next week", "by Friday", "end of month", "in 3 days", "before the conference"
- Detect urgency: "ASAP", "urgent", "immediately", "critical", "deadline today" = urgent priority
- Detect high priority: "important", "priority", "soon", "reviewer comments", "resubmit", "defense" = high priority
- Conference and grant deadlines are typically high/urgent priority
- Responding to reviewer comments should be high priority
- If no urgency mentioned, default to medium priority
- Only suggest assignee if a team member name is explicitly mentioned in the input
- Keep tasks concise (under 100 characters when possible)

Examples:
- "email advisor tmrw about results" -> { "text": "Email advisor about results", "dueDate": "2024-01-16", "priority": "medium", "assignedTo": "", "wasEnhanced": true }
- "ASAP revise methods section" -> { "text": "Revise methods section", "priority": "urgent", "dueDate": "", "assignedTo": "", "wasEnhanced": true }
- "have sarah run the stats by friday" -> { "text": "Run statistical analysis", "priority": "medium", "dueDate": "2024-01-19", "assignedTo": "Sarah", "wasEnhanced": true }
- "Submit abstract to ESA conference" -> { "text": "Submit abstract to ESA conference", "priority": "high", "dueDate": "", "assignedTo": "", "wasEnhanced": false }

Respond with ONLY the JSON object, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Failed to parse AI response', undefined, { component: 'EnhanceTaskAPI', responseText });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const enhanced = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    const validatedResult = {
      text: enhanced.text || text,
      priority: ['low', 'medium', 'high', 'urgent'].includes(enhanced.priority)
        ? enhanced.priority
        : 'medium',
      dueDate: enhanced.dueDate || '',
      assignedTo: enhanced.assignedTo || '',
      wasEnhanced: Boolean(enhanced.wasEnhanced),
    };

    return NextResponse.json({
      success: true,
      enhanced: validatedResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error enhancing task', error, { component: 'EnhanceTaskAPI', details: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to enhance task', details: errorMessage },
      { status: 500 }
    );
  }
});
