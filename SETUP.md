# Shared Todo List Setup

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to initialize

## 2. Create the Database Table

Go to the SQL Editor in your Supabase dashboard and run:

```sql
-- Create the todos table
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for simplicity)
CREATE POLICY "Allow all operations" ON todos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for the todos table
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
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

- **Real-time sync**: Changes appear instantly across all connected clients
- **Multi-user**: Each user enters their name and can see who created each todo
- **Optimistic updates**: UI updates immediately while syncing in background
- **Persistent sessions**: User names are saved in localStorage
