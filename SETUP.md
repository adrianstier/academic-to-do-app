# Shared Todo List Setup

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to initialize

## 2. Create the Database Tables

Go to the SQL Editor in your Supabase dashboard and run:

```sql
-- Create the users table (for PIN-based authentication)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  color TEXT DEFAULT '#0033A0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  streak_count INTEGER DEFAULT 0,
  streak_last_date DATE,
  welcome_shown_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow reading users (for login screen)
CREATE POLICY "Allow read users" ON users
  FOR SELECT USING (true);

-- Allow insert for registration
CREATE POLICY "Allow insert users" ON users
  FOR INSERT WITH CHECK (true);

-- Allow update for last_login
CREATE POLICY "Allow update users" ON users
  FOR UPDATE USING (true) WITH CHECK (true);

-- Create the todos table
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  assigned_to TEXT,
  due_date TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations" ON todos
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
```

## 3. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to Project Settings > API
   - Copy the "Project URL" and "anon public" key

3. Update `.env.local` with your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in multiple browser windows to test real-time sync!

## Features

- **PIN-based authentication**: Secure login with 4-digit PIN per user
- **User switching**: Quickly switch between team members from the header
- **Real-time sync**: Changes appear instantly across all connected clients
- **Multi-user**: Each user has their own account with color-coded avatar
- **Optimistic updates**: UI updates immediately while syncing in background
- **Rate limiting**: 3 failed PIN attempts triggers 30-second lockout

## Migrating Existing Database

If you already have the database set up, run this migration to add the new columns:

```sql
-- Add streak and notification tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_last_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_shown_at TIMESTAMP WITH TIME ZONE;

-- Add due_date column to todos table (if missing)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- Add priority and status columns to todos table (if missing)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';
ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_to TEXT;
```

## Outlook Add-in Setup

The app includes a Microsoft Outlook add-in that uses AI to convert emails into tasks.

### Environment Variables for Outlook Add-in

Add these to your `.env.local` (and Railway environment):

```
# Anthropic API (for AI email parsing)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Outlook Add-in API Key (shared secret for add-in authentication)
OUTLOOK_ADDON_API_KEY=your-secure-random-key
```

### Installing the Add-in in Outlook

The easiest way to install is via the in-app setup page at `/outlook-setup`.

#### Quick Method (All Platforms)

1. Go to your deployed app's `/outlook-setup` page
2. Download the manifest file:
   - **Web / New Outlook**: Use "Download for Web / New Outlook"
   - **Classic Desktop**: Use "Download for Classic Desktop"
3. Visit [aka.ms/olksideload](https://aka.ms/olksideload) in your browser
4. Click **"My add-ins"**
5. Scroll to **"Custom Addins"** and click **"Add a custom add-in"** → **"Add from File..."**
6. Select the downloaded manifest file
7. Click **"Install"**

#### Alternative: Outlook Desktop

1. In Outlook, go to **File** → **Info** → **Manage Add-ins**
2. This opens the Add-ins dialog in your browser
3. Follow steps 4-7 from the Quick Method above

#### Note

- The add-in syncs across all your Outlook clients (web, Windows, Mac)
- On classic Outlook for Windows, it may take up to 24 hours to appear due to caching
- Personal Microsoft accounts may have restrictions on custom add-ins

### Using the Add-in

1. Open an email in Outlook
2. Click the "Add to Todo" button in the ribbon (or find "Bealer Todo" in the add-ins panel)
3. Click "Analyze Email with AI" to extract task details
4. Review and edit the suggested task, assignee, priority, and due date
5. Click "Add Task" to create the task in your todo list

### API Endpoints

- `GET /api/outlook/users` - List all registered users
- `POST /api/outlook/parse-email` - AI-powered email parsing
- `POST /api/outlook/create-task` - Create a new task

All endpoints require the `X-API-Key` header matching `OUTLOOK_ADDON_API_KEY`.
