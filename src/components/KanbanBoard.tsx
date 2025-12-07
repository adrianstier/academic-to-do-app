'use client';

import { Todo, TodoStatus } from '@/types/todo';

interface KanbanBoardProps {
  todos: Todo[];
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDelete: (id: string) => void;
}

const columns: { id: TodoStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'bg-zinc-100 dark:bg-zinc-800' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'done', title: 'Done', color: 'bg-green-50 dark:bg-green-900/20' },
];

export default function KanbanBoard({ todos, onStatusChange, onDelete }: KanbanBoardProps) {
  const getTodosByStatus = (status: TodoStatus) => {
    return todos.filter((todo) => (todo.status || 'todo') === status);
  };

  const handleDragStart = (e: React.DragEvent, todoId: string) => {
    e.dataTransfer.setData('todoId', todoId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TodoStatus) => {
    e.preventDefault();
    const todoId = e.dataTransfer.getData('todoId');
    if (todoId) {
      onStatusChange(todoId, status);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className={`${column.color} rounded-xl p-4 min-h-[300px]`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-200">
              {column.title}
            </h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-700 px-2 py-0.5 rounded-full">
              {getTodosByStatus(column.id).length}
            </span>
          </div>

          <div className="space-y-3">
            {getTodosByStatus(column.id).map((todo) => (
              <div
                key={todo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, todo.id)}
                className="bg-white dark:bg-zinc-700 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
              >
                <p className={`text-sm ${todo.completed ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
                  {todo.text}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {todo.created_by}
                  </span>
                  <button
                    onClick={() => onDelete(todo.id)}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {getTodosByStatus(column.id).length === 0 && (
              <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm">
                Drop items here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
