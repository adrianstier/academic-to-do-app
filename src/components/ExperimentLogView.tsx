'use client';

import { motion } from 'framer-motion';
import {
  Binoculars,
  FlaskConical,
  ClipboardList,
  Cpu,
  PenTool,
  Calendar,
  Tag,
  FileText,
  Target,
  Beaker,
  BarChart3,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import MarkdownPreview from '@/components/task-detail/MarkdownPreview';
import type { ExperimentLog, ExperimentTemplate, ExperimentVariable } from '@/types/experiment';
import {
  EXPERIMENT_PRESETS,
  EXPERIMENT_STATUS_CONFIG,
  VARIABLE_TYPE_CONFIG,
} from '@/types/experiment';

// ============================================
// Props
// ============================================

interface ExperimentLogViewProps {
  log: ExperimentLog;
  className?: string;
}

// ============================================
// Icon map for template display
// ============================================

const TEMPLATE_ICONS: Record<ExperimentTemplate, React.ElementType> = {
  field_observation: Binoculars,
  lab_experiment: FlaskConical,
  survey: ClipboardList,
  computational: Cpu,
  custom: PenTool,
};

// ============================================
// Section animation
// ============================================

const sectionVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * i, duration: 0.2 },
  }),
};

// ============================================
// Section wrapper for consistent card styling
// ============================================

function Section({
  icon,
  title,
  index,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      className="rounded-xl p-4 border"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

// ============================================
// Variable Table
// ============================================

function VariableTable({ variables }: { variables: ExperimentVariable[] }) {
  if (variables.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        No variables recorded.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            {['Name', 'Type', 'Value', 'Units'].map((col) => (
              <th
                key={col}
                className="text-left text-xs font-medium px-3 py-2"
                style={{
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variables.map((v, idx) => {
            const typeConfig = VARIABLE_TYPE_CONFIG[v.type];
            return (
              <tr key={idx}>
                <td
                  className="px-3 py-2 font-medium"
                  style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}
                >
                  {v.name || '--'}
                </td>
                <td className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: typeConfig.bgColor, color: typeConfig.color }}
                  >
                    {typeConfig.label}
                  </span>
                </td>
                <td
                  className="px-3 py-2"
                  style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}
                >
                  {v.value || '--'}
                </td>
                <td
                  className="px-3 py-2"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                >
                  {v.units || '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Equipment Chips
// ============================================

function EquipmentChips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        No equipment listed.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center text-xs px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ============================================
// Markdown section content
// ============================================

function MarkdownContent({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
        Not recorded.
      </p>
    );
  }
  return <MarkdownPreview content={content} className="rounded-lg" />;
}

// ============================================
// Main View Component
// ============================================

export default function ExperimentLogView({ log, className = '' }: ExperimentLogViewProps) {
  const preset = EXPERIMENT_PRESETS[log.template_type];
  const statusConfig = EXPERIMENT_STATUS_CONFIG[log.status];
  const TemplateIcon = TEMPLATE_ICONS[log.template_type];

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Header: Template + Status + Dates ── */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="flex flex-wrap items-center gap-3 pb-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Template badge */}
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        >
          <TemplateIcon className="w-3.5 h-3.5" />
          {preset.label}
        </span>

        {/* Status badge */}
        <span
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: statusConfig.bgColor, color: statusConfig.color }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusConfig.color }}
          />
          {statusConfig.label}
        </span>

        {/* Dates */}
        <span
          className="inline-flex items-center gap-1 text-xs ml-auto"
          style={{ color: 'var(--text-muted)' }}
        >
          <Calendar className="w-3 h-3" />
          {formatDate(log.start_date)}
          {log.end_date && ` - ${formatDate(log.end_date)}`}
        </span>
      </motion.div>

      {/* ── Hypothesis ── */}
      <Section icon={<Target className="w-4 h-4" />} title="Hypothesis" index={1}>
        <MarkdownContent content={log.hypothesis} />
      </Section>

      {/* ── Methods ── */}
      <Section icon={<Beaker className="w-4 h-4" />} title="Methods" index={2}>
        <MarkdownContent content={log.methods} />
      </Section>

      {/* ── Variables ── */}
      <Section icon={<BarChart3 className="w-4 h-4" />} title="Variables" index={3}>
        <VariableTable variables={log.variables} />
      </Section>

      {/* ── Observations ── */}
      <Section icon={<Eye className="w-4 h-4" />} title="Observations" index={4}>
        <MarkdownContent content={log.observations} />
      </Section>

      {/* ── Results ── */}
      <Section icon={<FileText className="w-4 h-4" />} title="Results" index={5}>
        <MarkdownContent content={log.results} />
      </Section>

      {/* ── Conclusion ── */}
      <Section icon={<CheckCircle2 className="w-4 h-4" />} title="Conclusion" index={6}>
        <MarkdownContent content={log.conclusion} />
      </Section>

      {/* ── Equipment ── */}
      <Section icon={<Tag className="w-4 h-4" />} title="Equipment" index={7}>
        <EquipmentChips items={log.equipment} />
      </Section>

      {/* ── Print-friendly footer metadata ── */}
      <motion.div
        custom={8}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="flex flex-wrap gap-x-6 gap-y-1 pt-3 border-t text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <span>Created: {formatDate(log.created_at)}</span>
        <span>Updated: {formatDate(log.updated_at)}</span>
        <span>ID: {log.id.slice(0, 8)}</span>
      </motion.div>
    </div>
  );
}
