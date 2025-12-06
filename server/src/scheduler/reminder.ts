import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

export interface ReminderHandler {
  sendReminder(taskId: string, title: string, assignee: string | null): Promise<void>;
}

// Default console logger - can be swapped with email/Slack handler
const consoleReminderHandler: ReminderHandler = {
  async sendReminder(taskId: string, title: string, assignee: string | null) {
    console.log(`[REMINDER] Task #${taskId} (${title}) is due soon for ${assignee || 'unassigned'}`);
  },
};

let reminderHandler: ReminderHandler = consoleReminderHandler;

export function setReminderHandler(handler: ReminderHandler) {
  reminderHandler = handler;
}

export function startReminderScheduler(prisma: PrismaClient) {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find tasks where reminder time has passed, not done, and reminder not sent
      const tasks = await prisma.task.findMany({
        where: {
          reminderTime: {
            lte: now,
          },
          status: {
            not: 'done',
          },
          reminderSent: false,
        },
      });

      for (const task of tasks) {
        await reminderHandler.sendReminder(task.id, task.title, task.assignee);

        // Mark reminder as sent
        await prisma.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        });
      }

      if (tasks.length > 0) {
        console.log(`[SCHEDULER] Processed ${tasks.length} reminder(s)`);
      }
    } catch (error) {
      console.error('[SCHEDULER] Error processing reminders:', error);
    }
  });

  console.log('[SCHEDULER] Reminder scheduler started (runs every minute)');
}
