import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { taskRouter } from './routes/tasks';
import { apiKeyMiddleware } from './middleware/apiKey';
import { loggingMiddleware } from './middleware/logging';
import { startReminderScheduler } from './scheduler/reminder';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5566;

// Middleware
app.use(cors({
  origin: ['http://localhost:3333', 'http://localhost:3002', 'https://localhost:3002'],
  credentials: true,
}));
app.use(express.json());
app.use(loggingMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/tasks', apiKeyMiddleware, taskRouter);

// Start server
async function main() {
  await prisma.$connect();
  console.log('Connected to database');

  // Start reminder scheduler
  startReminderScheduler(prisma);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main()
  .catch((e) => {
    console.error('Failed to start server:', e);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };
