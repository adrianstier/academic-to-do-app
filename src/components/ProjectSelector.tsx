'use client';

import type { Project } from '@/types/project';

interface ProjectSelectorProps {
  value: string | undefined;
  onChange: (projectId: string | undefined) => void;
  projects: Project[];
  className?: string;
  placeholder?: string;
}

export default function ProjectSelector({
  value,
  onChange,
  projects,
  className = '',
  placeholder = 'No Project',
}: ProjectSelectorProps) {
  const activeProjects = projects.filter(p => p.status === 'active');
  const selectedProject = projects.find(p => p.id === value);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {selectedProject && (
        <span
          className="absolute left-2.5 w-2.5 h-2.5 rounded-full flex-shrink-0 pointer-events-none z-10"
          style={{ backgroundColor: selectedProject.color }}
          aria-hidden="true"
        />
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label="Select project"
        className={`
          w-full text-sm font-medium rounded-lg border cursor-pointer
          transition-colors
          bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]
          hover:border-[var(--accent)]/40
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1
          ${selectedProject ? 'pl-7 pr-3 py-2' : 'px-3 py-2'}
        `}
      >
        <option value="">{placeholder}</option>
        {activeProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
