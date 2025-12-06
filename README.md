# To-Do App with Outlook Add-in

A complete task management system with:
1. **Web App** - Next.js frontend for managing tasks
2. **API Server** - Express + Prisma + SQLite backend
3. **Outlook Add-in** - Create tasks directly from emails

## Repository Structure

```
root/
├── server/           # Express API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/tasks.ts
│   │   ├── middleware/
│   │   └── scheduler/reminder.ts
│   └── prisma/schema.prisma
├── web/              # Next.js frontend
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/api.ts
│       └── types/task.ts
├── outlook-addin/    # Outlook add-in
│   ├── src/
│   │   ├── taskpane.ts
│   │   ├── taskpane.html
│   │   └── config.ts
│   └── manifest.xml
└── README.md
```

## Requirements

- Node.js 18+ (LTS recommended)
- npm 9+

## Setup

### 1. Server Setup

```bash
cd server
npm install
npx prisma generate
npx prisma db push
```

Configure environment (optional - defaults work out of the box):
```bash
cp .env.example .env
# Edit .env to set API_KEY if desired
```

### 2. Web App Setup

```bash
cd web
npm install
```

Configure API URL (optional):
```bash
cp .env.example .env.local
# Edit .env.local if API is not on localhost:3001
```

### 3. Outlook Add-in Setup

```bash
cd outlook-addin
npm install
```

Configure API endpoint:
```bash
# Edit src/config.ts to set your API URL and API key
```

#### Add-in Icons

Create icon files in `outlook-addin/assets/`:
- icon-16.png (16x16)
- icon-32.png (32x32)
- icon-64.png (64x64)
- icon-80.png (80x80)
- icon-128.png (128x128)

## Running Locally

### Start the Server (Terminal 1)

```bash
cd server
npm run dev
```

Server runs at: http://localhost:3001

### Start the Web App (Terminal 2)

```bash
cd web
npm run dev
```

Web app runs at: http://localhost:3000

### Start the Outlook Add-in Dev Server (Terminal 3)

```bash
cd outlook-addin
npm run dev
```

Add-in dev server runs at: https://localhost:3002

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Create a new task |
| GET | `/tasks` | List tasks (supports filters) |
| GET | `/tasks/:id` | Get a single task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |

### Query Parameters for GET /tasks

- `status` - Filter by status (todo, in_progress, done)
- `assignee` - Filter by assignee name
- `search` - Search in title and description

### API Authentication

Set `API_KEY` in server's `.env` to enable authentication. Include `X-API-KEY` header in requests.

## Sideloading the Outlook Add-in

### Option 1: Outlook on the Web

1. Go to https://outlook.office.com
2. Open any email
3. Click the "..." (More actions) button
4. Select "Get Add-ins"
5. Click "My add-ins" in the left sidebar
6. Scroll down to "Custom add-ins"
7. Click "Add a custom add-in" → "Add from file..."
8. Select `outlook-addin/dist/manifest.xml` (after running `npm run build`)

### Option 2: Outlook Desktop (Windows)

1. Open Outlook
2. Go to File → Manage Add-ins
3. Click "+" and select "Add from file"
4. Select the manifest.xml file

### Option 3: Using Office Add-in Dev Tools

```bash
# Install the Office Add-in CLI
npm install -g office-addin-dev-certs office-addin-debugging

# Trust the dev certificate (one-time)
npx office-addin-dev-certs install

# Sideload to Outlook
npx office-addin-debugging start outlook-addin/manifest.xml desktop
```

## Example Flow

1. **Start all services** (server, web, outlook-addin)

2. **Create a task from Outlook:**
   - Open Outlook (web or desktop)
   - Open any email
   - Click the "Create To-Do" button in the ribbon
   - Fill in the task details (title is pre-filled from subject)
   - Set due date and reminder
   - Select assignee (Adrian or Assistant)
   - Click "Create Task"

3. **View the task in the web app:**
   - Go to http://localhost:3000
   - See your new task in the list
   - Click to view/edit details
   - See the email source information

4. **Manage tasks:**
   - Change status using the dropdown
   - Filter by status, assignee, or search
   - Click a task to edit details
   - Delete tasks when done

## Task Data Model

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (UUID) |
| title | string | Task title (required) |
| description | string | Task description |
| status | enum | todo, in_progress, done |
| assignee | string | Person assigned (Adrian, Assistant) |
| dueDate | datetime | When the task is due |
| reminderTime | datetime | When to send reminder |
| reminderSent | boolean | Whether reminder was sent |
| sourceEmailId | string | Outlook email ID (if from email) |
| sourceEmailFrom | string | Email sender |
| sourceEmailReceived | datetime | When email was received |
| createdAt | datetime | Task creation time |
| updatedAt | datetime | Last update time |

## Reminder System

The server runs a scheduler that checks every minute for tasks with:
- `reminderTime` <= now
- `status` != "done"
- `reminderSent` = false

When found, it logs:
```
[REMINDER] Task #<id> (<title>) is due soon for <assignee>
```

To integrate with email/Slack, modify `server/src/scheduler/reminder.ts`:

```typescript
import { setReminderHandler } from './scheduler/reminder';

setReminderHandler({
  async sendReminder(taskId, title, assignee) {
    // Send to Slack, email, etc.
  }
});
```

## Development

### Server Scripts

```bash
npm run dev      # Run with hot reload
npm run build    # Build for production
npm run start    # Run production build
npm run db:migrate  # Run Prisma migrations
npm run db:push     # Push schema to database
```

### Web Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Run production build
```

### Outlook Add-in Scripts

```bash
npm run dev      # Start dev server (https://localhost:3002)
npm run build    # Build for production
```

## Troubleshooting

### Server won't start
- Check if port 3001 is in use
- Run `npx prisma db push` to ensure database is created

### Web app can't connect to API
- Ensure server is running on port 3001
- Check CORS settings in server/src/index.ts

### Outlook add-in not appearing
- Ensure dev server is running on https://localhost:3002
- Accept the self-signed certificate in your browser
- Clear Outlook add-in cache and reload

### Add-in shows "Loading email..." forever
- Check browser console for errors
- Ensure you're viewing an email (not inbox list)
- Try refreshing the add-in panel

## Production Deployment

### Server
1. Set `DATABASE_URL` to your production database
2. Set a secure `API_KEY`
3. Run `npm run build && npm start`

### Web
1. Set `NEXT_PUBLIC_API_URL` to your production API
2. Run `npm run build && npm start`

### Outlook Add-in
1. Update URLs in `manifest.xml` to production URLs
2. Update `src/config.ts` with production API URL
3. Run `npm run build`
4. Deploy to static hosting (Azure, AWS S3, etc.)
5. Submit manifest to Microsoft AppSource or deploy to organization
