# Bealer Agency Todo List

A real-time collaborative task management app built for small teams, with an AI-powered Outlook add-in to convert emails into tasks.

## Features

- **Real-time sync** - Changes appear instantly across all connected clients via Supabase
- **PIN-based authentication** - Secure 4-digit PIN login per user
- **User switching** - Quickly switch between team members on shared devices
- **Kanban board** - Drag-and-drop task management with Todo/In Progress/Done columns
- **List view** - Traditional list view with filtering and sorting
- **Task priorities** - Low, Medium, High, and Urgent priority levels
- **Due dates** - Set and track task deadlines
- **Assignees** - Assign tasks to team members
- **Streak tracking** - Daily login streaks with welcome notifications
- **Outlook Add-in** - Convert emails to tasks using AI (Claude)

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **AI**: Anthropic Claude API (for email parsing)
- **Deployment**: Railway

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/adrianstier/shared-todo-list.git
cd shared-todo-list
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OUTLOOK_ADDON_API_KEY=your-secure-random-key
```

### 3. Set Up Database

Run the SQL in `SETUP.md` in your Supabase SQL Editor to create the required tables.

### 4. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

## Project Structure

```
shared-todo-list/
├── public/
│   └── outlook/              # Outlook add-in static files
│       ├── manifest.xml      # Web/New Outlook manifest
│       ├── manifest-desktop.xml  # Classic desktop manifest
│       ├── taskpane.html     # Add-in UI
│       └── icon-*.png        # Add-in icons
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main app page
│   │   ├── outlook-setup/    # Outlook installation instructions
│   │   └── api/
│   │       └── outlook/      # Outlook add-in API endpoints
│   ├── components/
│   │   ├── TodoList.tsx      # Main todo list component
│   │   ├── TodoItem.tsx      # Individual task item
│   │   ├── KanbanBoard.tsx   # Kanban board view
│   │   ├── AddTodo.tsx       # Add task form
│   │   ├── LoginScreen.tsx   # PIN authentication
│   │   └── UserSwitcher.tsx  # User switching dropdown
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   └── auth.ts           # PIN hashing utilities
│   └── types/
│       └── todo.ts           # TypeScript types
├── tests/                    # Playwright E2E tests
├── SETUP.md                  # Detailed setup instructions
└── package.json
```

## Outlook Add-in

The Outlook add-in allows you to convert emails into tasks with one click. The AI automatically extracts:

- **Task description** - Clear, actionable task from email content
- **Assignee** - Detects who should handle the task
- **Priority** - Identifies urgency from email content
- **Due date** - Parses deadlines like "by Friday" or "end of week"

### Installing the Add-in

1. Go to your deployed app's `/outlook-setup` page
2. Download the appropriate manifest (Web/New Outlook or Classic Desktop)
3. Go to https://aka.ms/olksideload
4. Upload the manifest file under "Custom Add-ins"

See `SETUP.md` for detailed instructions.

## API Endpoints

All Outlook API endpoints require the `X-API-Key` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/outlook/users` | GET | List registered users |
| `/api/outlook/parse-email` | POST | AI-powered email parsing |
| `/api/outlook/create-task` | POST | Create a new task |

## Running Tests

```bash
# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test file
npx playwright test tests/core-flow.spec.ts
```

## Deployment

The app is configured for Railway deployment:

1. Push to GitHub
2. Connect Railway to the repository
3. Add environment variables in Railway dashboard
4. Deploy

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `OUTLOOK_ADDON_API_KEY` | Shared secret for Outlook add-in |

## License

Private - Bealer Agency
