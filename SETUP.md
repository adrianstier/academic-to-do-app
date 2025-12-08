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
  last_login TIMESTAMP WITH TIME ZONE
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
