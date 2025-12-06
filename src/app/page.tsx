'use client';

import { useState, useEffect } from 'react';
import TodoList from '@/components/TodoList';
import UserSetup from '@/components/UserSetup';

export default function Home() {
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user name exists in localStorage
    const storedName = localStorage.getItem('todoUserName');
    if (storedName) {
      setUserName(storedName);
    }
    setIsLoading(false);
  }, []);

  const handleSetUser = (name: string) => {
    localStorage.setItem('todoUserName', name);
    setUserName(name);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!userName) {
    return <UserSetup onSetUser={handleSetUser} />;
  }

  return <TodoList userName={userName} />;
}
