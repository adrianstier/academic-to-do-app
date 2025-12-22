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

// GET - Fetch all goal categories
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get('userName');

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('goal_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST - Create a new category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color, icon, userName } = body;

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Get max display_order
    const { data: maxOrderData } = await supabase
      .from('goal_categories')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('goal_categories')
      .insert({
        name,
        color: color || '#6366f1',
        icon: icon || 'target',
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// PUT - Update a category
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, color, icon, display_order, userName } = body;

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data, error } = await supabase
      .from('goal_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE - Delete a category
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
      .from('goal_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
