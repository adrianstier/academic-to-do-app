'use client';

import { Check, Copy, FileText, Mail } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';
import type { Todo } from '@/types/todo';

interface QuickActionsBarProps {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDuplicate?: (todo: Todo) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onEmailCustomer?: (todo: Todo) => void;
}

export default function QuickActionsBar({
  todo,
  onToggle,
  onDuplicate,
  onSaveAsTemplate,
  onEmailCustomer,
}: QuickActionsBarProps) {
  return (
    <div className="flex items-center justify-between">
      <Button
        variant={todo.completed ? 'secondary' : 'success'}
        size="md"
        leftIcon={<Check className="w-4 h-4" />}
        onClick={() => onToggle(todo.id, !todo.completed)}
      >
        {todo.completed ? 'Reopen Task' : 'Mark Done'}
      </Button>

      <div className="flex items-center gap-2">
        {onDuplicate && (
          <IconButton
            variant="ghost"
            size="sm"
            icon={<Copy className="w-4 h-4" />}
            onClick={() => onDuplicate(todo)}
            aria-label="Duplicate task"
          />
        )}
        {onSaveAsTemplate && (
          <IconButton
            variant="ghost"
            size="sm"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => onSaveAsTemplate(todo)}
            aria-label="Save as template"
          />
        )}
        {onEmailCustomer && (
          <IconButton
            variant="ghost"
            size="sm"
            icon={<Mail className="w-4 h-4" />}
            onClick={() => onEmailCustomer(todo)}
            aria-label="Email summary"
          />
        )}
      </div>
    </div>
  );
}
