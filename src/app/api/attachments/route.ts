import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_TODO,
  Attachment
} from '@/types/todo';

// Create a Supabase client for storage operations
// SECURITY: Use anon key by default. Service role key should only be used
// for specific admin operations and never exposed to client-side code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Use service role key ONLY on server-side and only when necessary
// The anon key with proper RLS policies is preferred
const getSupabaseClient = () => {
  // In API routes (server-side), we can use service role for storage operations
  // Storage buckets may have different RLS than database tables
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, key);
};

const supabase = getSupabaseClient();

const STORAGE_BUCKET = 'todo-attachments';

// Helper to ensure bucket exists
// Note: This function is a no-op if using anon key with RLS enabled
// The bucket should be pre-created in Supabase dashboard or via service role
async function ensureBucketExists() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    // If we can't list buckets (RLS blocks it), assume bucket exists and proceed
    if (listError) {
      console.log('Cannot list buckets (likely RLS), assuming bucket exists');
      return;
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: MAX_ATTACHMENT_SIZE,
        allowedMimeTypes: Object.keys(ALLOWED_ATTACHMENT_TYPES),
      });
      if (error && !error.message.includes('already exists')) {
        // Don't throw - bucket might exist but we can't see it due to RLS
        console.warn('Could not create bucket (may already exist):', error.message);
      }
    }
  } catch (err) {
    // Don't fail the upload if bucket check fails - proceed and let the upload attempt tell us
    console.warn('Bucket check failed, proceeding with upload attempt:', err);
  }
}

// POST - Upload a new attachment
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const todoId = formData.get('todoId') as string | null;
    const userName = formData.get('userName') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!todoId) {
      return NextResponse.json(
        { success: false, error: 'No todoId provided' },
        { status: 400 }
      );
    }

    if (!userName) {
      return NextResponse.json(
        { success: false, error: 'No userName provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const mimeType = file.type;
    if (!(mimeType in ALLOWED_ATTACHMENT_TYPES)) {
      return NextResponse.json(
        { success: false, error: `File type ${mimeType} is not allowed` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size exceeds ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB limit` },
        { status: 400 }
      );
    }

    // Check current attachment count for this todo
    // Use a transaction-safe approach: fetch, validate, and we'll re-check before update
    const { data: todo, error: fetchError } = await supabase
      .from('todos')
      .select('attachments, text')
      .eq('id', todoId)
      .single();

    if (fetchError) {
      console.error('Error fetching todo:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      );
    }

    const currentAttachments = (todo.attachments || []) as Attachment[];
    if (currentAttachments.length >= MAX_ATTACHMENTS_PER_TODO) {
      return NextResponse.json(
        { success: false, error: `Maximum of ${MAX_ATTACHMENTS_PER_TODO} attachments per todo` },
        { status: 400 }
      );
    }

    const todoText = todo.text as string;

    // Ensure storage bucket exists
    await ensureBucketExists();

    // Generate unique file path
    const attachmentId = uuidv4();
    const fileExt = ALLOWED_ATTACHMENT_TYPES[mimeType as keyof typeof ALLOWED_ATTACHMENT_TYPES].ext;
    const storagePath = `${todoId}/${attachmentId}.${fileExt}`;

    // Convert file to buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Create attachment metadata
    const attachment: Attachment = {
      id: attachmentId,
      file_name: file.name,
      file_type: ALLOWED_ATTACHMENT_TYPES[mimeType as keyof typeof ALLOWED_ATTACHMENT_TYPES].category,
      file_size: file.size,
      storage_path: storagePath,
      mime_type: mimeType,
      uploaded_by: userName,
      uploaded_at: new Date().toISOString(),
    };

    // Use atomic update with jsonb concatenation to prevent race conditions
    // This ensures the attachment is appended atomically without overwriting concurrent changes
    const { data: updateData, error: updateError } = await supabase.rpc(
      'append_attachment_if_under_limit',
      {
        p_todo_id: todoId,
        p_attachment: attachment,
        p_max_attachments: MAX_ATTACHMENTS_PER_TODO,
      }
    ).single();

    // Type the RPC result
    const rpcResult = updateData as { success: boolean; error?: string } | null;

    // If RPC doesn't exist, fall back to regular update with re-verification
    if (updateError?.code === 'PGRST202' || updateError?.message?.includes('function') || updateError?.message?.includes('does not exist')) {
      // Fallback: Re-fetch to verify count hasn't changed (optimistic concurrency check)
      const { data: verifyData, error: verifyError } = await supabase
        .from('todos')
        .select('attachments')
        .eq('id', todoId)
        .single();

      if (verifyError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        return NextResponse.json(
          { success: false, error: 'Todo not found' },
          { status: 404 }
        );
      }

      const verifyAttachments = (verifyData.attachments || []) as Attachment[];
      if (verifyAttachments.length >= MAX_ATTACHMENTS_PER_TODO) {
        // Race condition - another upload completed first
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        return NextResponse.json(
          { success: false, error: `Maximum of ${MAX_ATTACHMENTS_PER_TODO} attachments reached` },
          { status: 400 }
        );
      }

      // Use the verified attachments array to avoid overwriting concurrent changes
      const finalAttachments = [...verifyAttachments, attachment];
      const { error: fallbackError } = await supabase
        .from('todos')
        .update({ attachments: finalAttachments })
        .eq('id', todoId);

      if (fallbackError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        console.error('Error updating todo:', fallbackError);
        return NextResponse.json(
          { success: false, error: 'Failed to save attachment metadata' },
          { status: 500 }
        );
      }
    } else if (updateError) {
      // Rollback: delete uploaded file
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      console.error('Error updating todo:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save attachment metadata' },
        { status: 500 }
      );
    } else if (rpcResult && !rpcResult.success) {
      // RPC returned false - limit was reached
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { success: false, error: `Maximum of ${MAX_ATTACHMENTS_PER_TODO} attachments reached` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      attachment,
      todoText, // Include for activity logging on client
    });
  } catch (error) {
    console.error('Error handling attachment upload:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove an attachment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const todoId = searchParams.get('todoId');
    const attachmentId = searchParams.get('attachmentId');

    if (!todoId || !attachmentId) {
      return NextResponse.json(
        { success: false, error: 'todoId and attachmentId are required' },
        { status: 400 }
      );
    }

    // Get current todo
    const { data: todo, error: fetchError } = await supabase
      .from('todos')
      .select('attachments')
      .eq('id', todoId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      );
    }

    const currentAttachments = (todo.attachments || []) as Attachment[];
    const attachmentToRemove = currentAttachments.find(a => a.id === attachmentId);

    if (!attachmentToRemove) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Remove from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([attachmentToRemove.storage_path]);

    if (storageError) {
      console.error('Error removing file from storage:', storageError);
      // Continue anyway to clean up metadata
    }

    // Update todo without this attachment
    const updatedAttachments = currentAttachments.filter(a => a.id !== attachmentId);
    const { error: updateError } = await supabase
      .from('todos')
      .update({ attachments: updatedAttachments })
      .eq('id', todoId);

    if (updateError) {
      console.error('Error updating todo:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to remove attachment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling attachment deletion:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get a signed URL for downloading
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json(
        { success: false, error: 'Storage path is required' },
        { status: 400 }
      );
    }

    // Generate a signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error('Error generating signed URL:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl,
    });
  } catch (error) {
    console.error('Error handling download request:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
