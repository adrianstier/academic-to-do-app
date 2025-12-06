import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /tasks/stats - Get task statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const [total, byStatus, byPriority, byAssignee, overdue, dueToday, dueSoon] = await Promise.all([
      prisma.task.count(),
      prisma.task.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.task.groupBy({
        by: ['priority'],
        _count: { priority: true },
      }),
      prisma.task.groupBy({
        by: ['assignee'],
        _count: { assignee: true },
        where: { assignee: { not: null } },
      }),
      prisma.task.count({
        where: {
          dueDate: { lt: now },
          status: { not: 'done' },
        },
      }),
      prisma.task.count({
        where: {
          dueDate: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
            lt: new Date(now.setHours(23, 59, 59, 999)),
          },
          status: { not: 'done' },
        },
      }),
      prisma.task.count({
        where: {
          dueDate: {
            gte: now,
            lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          status: { not: 'done' },
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((s) => {
      statusMap[s.status] = s._count.status;
    });

    const priorityMap: Record<string, number> = {};
    byPriority.forEach((p) => {
      priorityMap[p.priority] = p._count.priority;
    });

    const assigneeMap: Record<string, number> = {};
    byAssignee.forEach((a) => {
      if (a.assignee) {
        assigneeMap[a.assignee] = a._count.assignee;
      }
    });

    res.json({
      total,
      byStatus: statusMap,
      byPriority: priorityMap,
      byAssignee: assigneeMap,
      overdue,
      dueToday,
      dueSoon,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /tasks - Create a new task
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      category,
      assignee,
      dueDate,
      reminderTime,
      sourceEmailId,
      sourceEmailFrom,
      sourceEmailReceived,
    } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        category,
        assignee,
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        sourceEmailId,
        sourceEmailFrom,
        sourceEmailReceived: sourceEmailReceived ? new Date(sourceEmailReceived) : null,
      },
      include: { notes: true },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /tasks - List tasks with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, category, assignee, search, overdue } = req.query;

    const where: Prisma.TaskWhereInput = {};

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (priority && typeof priority === 'string') {
      where.priority = priority;
    }

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (assignee && typeof assignee === 'string') {
      where.assignee = assignee;
    }

    if (overdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { not: 'done' };
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { notes: { orderBy: { createdAt: 'desc' } } },
      orderBy: [
        { priority: 'asc' }, // high first (alphabetically)
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /tasks/categories - Get all unique categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.task.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });

    res.json(categories.map((c) => c.category).filter(Boolean));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /tasks/:id - Get a single task
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PUT /tasks/:id - Update a task
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      category,
      assignee,
      dueDate,
      reminderTime,
    } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const updateData: Prisma.TaskUpdateInput = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (assignee !== undefined) updateData.assignee = assignee;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (reminderTime !== undefined) {
      updateData.reminderTime = reminderTime ? new Date(reminderTime) : null;
      updateData.reminderSent = false;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// POST /tasks/:id/notes - Add a note to a task
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, author } = req.body;

    if (!content || !author) {
      res.status(400).json({ error: 'Content and author are required' });
      return;
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const note = await prisma.note.create({
      data: {
        content,
        author,
        taskId: id,
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// DELETE /tasks/:id/notes/:noteId - Delete a note
router.delete('/:id/notes/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    await prisma.note.delete({ where: { id: noteId } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// POST /tasks/bulk - Bulk update tasks
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { ids, action, data } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Task IDs are required' });
      return;
    }

    if (action === 'delete') {
      await prisma.task.deleteMany({
        where: { id: { in: ids } },
      });
      res.json({ message: `Deleted ${ids.length} tasks` });
    } else if (action === 'update' && data) {
      const updateData: Prisma.TaskUpdateInput = {};
      if (data.status) updateData.status = data.status;
      if (data.priority) updateData.priority = data.priority;
      if (data.assignee !== undefined) updateData.assignee = data.assignee;
      if (data.category !== undefined) updateData.category = data.category;

      await prisma.task.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });
      res.json({ message: `Updated ${ids.length} tasks` });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// DELETE /tasks/all - Delete all tasks
router.delete('/all', async (req: Request, res: Response) => {
  try {
    // Delete all notes first (due to foreign key constraint)
    await prisma.note.deleteMany({});
    // Then delete all tasks
    const result = await prisma.task.deleteMany({});
    res.json({ message: `Deleted ${result.count} tasks` });
  } catch (error) {
    console.error('Error deleting all tasks:', error);
    res.status(500).json({ error: 'Failed to delete all tasks' });
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await prisma.task.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export { router as taskRouter };
