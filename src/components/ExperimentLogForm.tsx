'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Binoculars, FlaskConical, ClipboardList, Cpu, PenTool,
  Plus, X, Trash2, Save, ChevronDown, Calendar, Tag,
} from 'lucide-react';
import MarkdownToolbar from '@/components/task-detail/MarkdownToolbar';
import MarkdownPreview from '@/components/task-detail/MarkdownPreview';
import type { ExperimentLog, ExperimentTemplate, ExperimentVariable, ExperimentStatus } from '@/types/experiment';
import { EXPERIMENT_PRESETS, EXPERIMENT_STATUS_CONFIG, VARIABLE_TYPE_CONFIG } from '@/types/experiment';

interface ExperimentLogFormProps {
  todoId: string;
  existingLog?: ExperimentLog;
  onSave: (log: ExperimentLog) => void;
  onCancel: () => void;
}

const TEMPLATE_ICONS: Record<ExperimentTemplate, React.ElementType> = {
  field_observation: Binoculars, lab_experiment: FlaskConical,
  survey: ClipboardList, computational: Cpu, custom: PenTool,
};

const inputStyle = { background: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--border)' };

function MarkdownField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [isPreview, setIsPreview] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const autoResize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 80)}px`;
  }, []);
  useEffect(() => { autoResize(); }, [value, isPreview, autoResize]);

  const handleInsert = useCallback((before: string, after: string, ph: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = ta.value.substring(s, e);
    const ins = sel || ph;
    onChange(ta.value.substring(0, s) + before + ins + after + ta.value.substring(e));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = sel ? s + before.length + ins.length + after.length : s + before.length;
      ta.setSelectionRange(sel ? pos : pos, sel ? pos : pos + ph.length);
    });
  }, [onChange]);

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <MarkdownToolbar onInsert={handleInsert} isPreview={isPreview} onTogglePreview={() => setIsPreview(!isPreview)} />
        {isPreview ? <MarkdownPreview content={value} /> : (
          <textarea ref={taRef} value={value}
            onChange={(e) => { onChange(e.target.value); autoResize(); }}
            placeholder={placeholder}
            className="w-full text-sm px-3 py-2 resize-none border-0 outline-none"
            style={{ color: 'var(--foreground)', background: 'var(--surface)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.8125rem', lineHeight: '1.6', minHeight: '80px' }}
          />
        )}
      </div>
    </div>
  );
}

export default function ExperimentLogForm({ todoId, existingLog, onSave, onCancel }: ExperimentLogFormProps) {
  const [template, setTemplate] = useState<ExperimentTemplate>(existingLog?.template_type ?? 'custom');
  const [hypothesis, setHypothesis] = useState(existingLog?.hypothesis ?? '');
  const [methods, setMethods] = useState(existingLog?.methods ?? '');
  const [variables, setVariables] = useState<ExperimentVariable[]>(existingLog?.variables ?? []);
  const [observations, setObservations] = useState(existingLog?.observations ?? '');
  const [results, setResults] = useState(existingLog?.results ?? '');
  const [conclusion, setConclusion] = useState(existingLog?.conclusion ?? '');
  const [equipment, setEquipment] = useState<string[]>(existingLog?.equipment ?? []);
  const [equipmentInput, setEquipmentInput] = useState('');
  const [status, setStatus] = useState<ExperimentStatus>(existingLog?.status ?? 'planning');
  const [startDate, setStartDate] = useState(existingLog?.start_date ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(existingLog?.end_date ?? '');

  const applyTemplate = useCallback((t: ExperimentTemplate) => {
    setTemplate(t);
    const p = EXPERIMENT_PRESETS[t];
    if (!existingLog) {
      setMethods(p.defaultMethods);
      setVariables(p.defaultVariables);
      setObservations(p.defaultObservations);
      setEquipment(p.defaultEquipment);
    }
  }, [existingLog]);

  const addVariable = () => setVariables((v) => [...v, { name: '', type: 'independent', value: '', units: '' }]);
  const updateVariable = (i: number, f: keyof ExperimentVariable, val: string) =>
    setVariables((vs) => vs.map((v, j) => (j === i ? { ...v, [f]: val } : v)));
  const removeVariable = (i: number) => setVariables((v) => v.filter((_, j) => j !== i));

  const addEquipmentTag = () => {
    const t = equipmentInput.trim();
    if (t && !equipment.includes(t)) { setEquipment((e) => [...e, t]); setEquipmentInput(''); }
  };
  const removeEquipmentTag = (tag: string) => setEquipment((e) => e.filter((t) => t !== tag));

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate required fields
    if (!hypothesis.trim() && !methods.trim()) {
      setValidationError('Please provide at least a hypothesis or methods description.');
      return;
    }

    // Validate date range: end date must not be before start date
    if (endDate && startDate && endDate < startDate) {
      setValidationError('End date cannot be before start date.');
      return;
    }

    // Validate variables: named variables must have a type
    const invalidVars = variables.filter(v => v.name.trim() && !v.type);
    if (invalidVars.length > 0) {
      setValidationError('All named variables must have a type selected.');
      return;
    }

    const now = new Date().toISOString();
    onSave({
      id: existingLog?.id ?? crypto.randomUUID(), todo_id: todoId, template_type: template,
      hypothesis, methods, variables: variables.filter(v => v.name.trim()), observations, results, conclusion, equipment,
      start_date: startDate, end_date: endDate || undefined, status,
      created_at: existingLog?.created_at ?? now, updated_at: now,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Template Selector */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Experiment Template</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EXPERIMENT_PRESETS) as ExperimentTemplate[]).map((key) => {
            const Icon = TEMPLATE_ICONS[key]; const active = template === key;
            return (
              <button key={key} type="button" onClick={() => applyTemplate(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: active ? 'var(--accent)' : 'var(--surface-2)', color: active ? '#fff' : 'var(--foreground)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}` }}>
                <Icon className="w-3.5 h-3.5" />{EXPERIMENT_PRESETS[key].label}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{EXPERIMENT_PRESETS[template].description}</p>
      </div>

      {/* Status + Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
          <div className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value as ExperimentStatus)}
              className="w-full text-sm px-3 py-2 rounded-lg appearance-none pr-8 outline-none" style={inputStyle}>
              {(Object.keys(EXPERIMENT_STATUS_CONFIG) as ExperimentStatus[]).map((s) => (
                <option key={s} value={s}>{EXPERIMENT_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            <Calendar className="w-3 h-3" /> Start Date
          </label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            <Calendar className="w-3 h-3" /> End Date
          </label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
        </div>
      </div>

      <MarkdownField label="Hypothesis" value={hypothesis} onChange={setHypothesis} placeholder="State your hypothesis or research question..." />
      <MarkdownField label="Methods" value={methods} onChange={setMethods} placeholder="Describe your experimental methods and procedures..." />

      {/* Variables */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Variables</label>
          <button type="button" onClick={addVariable}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
            style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <AnimatePresence initial={false}>
          {variables.map((v, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
              className="grid grid-cols-[1fr_auto_80px_80px_32px] gap-2 mb-2 items-center">
              <input value={v.name} onChange={(e) => updateVariable(idx, 'name', e.target.value)}
                placeholder="Variable name" className="text-sm px-2 py-1.5 rounded-md outline-none" style={inputStyle} />
              <select value={v.type} onChange={(e) => updateVariable(idx, 'type', e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md outline-none appearance-none"
                style={{ background: VARIABLE_TYPE_CONFIG[v.type].bgColor, color: VARIABLE_TYPE_CONFIG[v.type].color, border: `1px solid ${VARIABLE_TYPE_CONFIG[v.type].color}40`, fontWeight: 500 }}>
                <option value="independent">Independent</option>
                <option value="dependent">Dependent</option>
                <option value="controlled">Controlled</option>
              </select>
              <input value={v.value ?? ''} onChange={(e) => updateVariable(idx, 'value', e.target.value)}
                placeholder="Value" className="text-sm px-2 py-1.5 rounded-md outline-none" style={inputStyle} />
              <input value={v.units ?? ''} onChange={(e) => updateVariable(idx, 'units', e.target.value)}
                placeholder="Units" className="text-sm px-2 py-1.5 rounded-md outline-none" style={inputStyle} />
              <button type="button" onClick={() => removeVariable(idx)}
                className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                aria-label="Remove variable">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {variables.length === 0 && (
          <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No variables defined. Click &quot;Add&quot; to add experimental variables.</p>
        )}
      </div>

      <MarkdownField label="Observations" value={observations} onChange={setObservations} placeholder="Record observations during the experiment..." />
      <MarkdownField label="Results" value={results} onChange={setResults} placeholder="Summarize quantitative and qualitative results..." />
      <MarkdownField label="Conclusion" value={conclusion} onChange={setConclusion} placeholder="Interpret results relative to your hypothesis..." />

      {/* Equipment Tags */}
      <div>
        <label className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          <Tag className="w-3 h-3" /> Equipment
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {equipment.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={inputStyle}>
              {tag}
              <button type="button" onClick={() => removeEquipmentTag(tag)} className="hover:opacity-70 transition-opacity" aria-label={`Remove ${tag}`}>
                <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={equipmentInput} onChange={(e) => setEquipmentInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEquipmentTag(); } }}
            placeholder="Add equipment..." className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none" style={inputStyle} />
          <button type="button" onClick={addEquipmentTag}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {validationError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}>Cancel</button>
        <button type="submit" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Save className="w-4 h-4" />{existingLog ? 'Update Log' : 'Save Log'}
        </button>
      </div>
    </form>
  );
}
