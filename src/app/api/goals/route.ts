import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OWNER_USERNAME } from '@/types/todo';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Verify owner access
function isOwner(userName: string | null): boolean {
  return userName === OWNER_USERNAME;
}

// GET - Fetch all strategic goals with categories and milestones
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get('userName');
    const categoryId = searchParams.get('categoryId');

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabase
      .from('strategic_goals')
      .select(`
        *,
        category:goal_categories(*),
        milestones:goal_milestones(*)
      `)
      .order('display_order', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

// POST - Create a new strategic goal
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category_id,
      status,
      priority,
      target_date,
      target_value,
      notes,
      created_by
    } = body;

    if (!isOwner(created_by)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!title || !created_by) {
      return NextResponse.json({ error: 'title and created_by are required' }, { status: 400 });
    }

    // Get max display_order for new goal
    const { data: maxOrderData } = await supabase
      .from('strategic_goals')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('strategic_goals')
      .insert({
        title,
        description: description || null,
        category_id: category_id || null,
        status: status || 'not_started',
        priority: priority || 'medium',
        target_date: target_date || null,
        target_value: target_value || null,
        notes: notes || null,
        display_order: nextOrder,
        created_by,
      })
      .select(`
        *,
        category:goal_categories(*),
        milestones:goal_milestones(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}

// PUT - Update a strategic goal
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      category_id,
      status,
      priority,
      target_date,
      target_value,
      current_value,
      progress_percent,
      notes,
      display_order,
      updated_by
    } = body;

    if (!isOwner(updated_by)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (target_date !== undefined) updateData.target_date = target_date;
    if (target_value !== undefined) updateData.target_value = target_value;
    if (current_value !== undefined) updateData.current_value = current_value;
    if (progress_percent !== undefined) updateData.progress_percent = progress_percent;
    if (notes !== undefined) updateData.notes = notes;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data, error } = await supabase
      .from('strategic_goals')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:goal_categories(*),
        milestones:goal_milestones(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

// DELETE - Delete a strategic goal
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userName = searchParams.get('userName');

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('strategic_goals')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
