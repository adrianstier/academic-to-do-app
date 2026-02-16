/**
 * Experiment Log Types for Academic Task Management
 *
 * Structured experiment logging linked to tasks. Supports multiple
 * template types for different research methodologies (field observations,
 * lab experiments, surveys, computational work).
 */

// ============================================
// Core Types
// ============================================

export type ExperimentTemplate =
  | 'field_observation'
  | 'lab_experiment'
  | 'survey'
  | 'computational'
  | 'custom';

export type ExperimentStatus = 'planning' | 'in_progress' | 'complete' | 'archived';

export interface ExperimentVariable {
  name: string;
  type: 'independent' | 'dependent' | 'controlled';
  value?: string;
  units?: string;
}

export interface ExperimentLog {
  id: string;
  todo_id: string;
  template_type: ExperimentTemplate;
  hypothesis: string;
  methods: string;
  variables: ExperimentVariable[];
  observations: string;
  results: string;
  conclusion: string;
  equipment: string[];
  start_date: string;
  end_date?: string;
  status: ExperimentStatus;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Template Presets
// ============================================

export interface ExperimentPreset {
  label: string;
  description: string;
  icon: string;
  defaultHypothesis: string;
  defaultMethods: string;
  defaultVariables: ExperimentVariable[];
  defaultObservations: string;
  defaultEquipment: string[];
}

export const EXPERIMENT_PRESETS: Record<ExperimentTemplate, ExperimentPreset> = {
  field_observation: {
    label: 'Field Observation',
    description: 'Structured field site observations with environmental context',
    icon: 'Binoculars',
    defaultHypothesis: '',
    defaultMethods:
      '## Site Description\n\n## Species / Subjects\n\n## Environmental Conditions\n\n## Sampling Protocol\n',
    defaultVariables: [
      { name: 'Site', type: 'independent', value: '', units: '' },
      { name: 'Species abundance', type: 'dependent', value: '', units: 'count' },
      { name: 'Temperature', type: 'controlled', value: '', units: 'C' },
      { name: 'Depth', type: 'controlled', value: '', units: 'm' },
    ],
    defaultObservations:
      '## Field Notes\n\n## Weather Conditions\n\n## Notable Events\n',
    defaultEquipment: ['GPS', 'Transect tape', 'Quadrat', 'Camera', 'Data sheets'],
  },
  lab_experiment: {
    label: 'Lab Experiment',
    description: 'Controlled laboratory experiment with replicates and protocols',
    icon: 'FlaskConical',
    defaultHypothesis: '',
    defaultMethods:
      '## Protocol Reference\n\n## Controls\n- Positive control: \n- Negative control: \n\n## Replicates\n- Number of replicates: \n- Sample size per replicate: \n\n## Procedure\n1. \n2. \n3. \n',
    defaultVariables: [
      { name: 'Treatment', type: 'independent', value: '', units: '' },
      { name: 'Response', type: 'dependent', value: '', units: '' },
      { name: 'Temperature', type: 'controlled', value: '', units: 'C' },
      { name: 'pH', type: 'controlled', value: '', units: '' },
    ],
    defaultObservations:
      '## Raw Observations\n\n## Anomalies / Deviations from Protocol\n',
    defaultEquipment: ['Pipettes', 'Spectrophotometer', 'Incubator', 'Balance'],
  },
  survey: {
    label: 'Survey',
    description: 'Survey or questionnaire-based data collection',
    icon: 'ClipboardList',
    defaultHypothesis: '',
    defaultMethods:
      '## Target Population\n\n## Sampling Method\n\n## Sample Size\n- Target: \n- Achieved: \n\n## Response Rate\n\n## Survey Instrument\n',
    defaultVariables: [
      { name: 'Survey group', type: 'independent', value: '', units: '' },
      { name: 'Response score', type: 'dependent', value: '', units: 'Likert' },
      { name: 'Demographics', type: 'controlled', value: '', units: '' },
    ],
    defaultObservations:
      '## Response Summary\n\n## Non-response Notes\n\n## Data Quality Issues\n',
    defaultEquipment: ['Survey platform', 'Consent forms', 'IRB approval'],
  },
  computational: {
    label: 'Computational',
    description: 'Computational modeling, simulation, or analysis pipeline',
    icon: 'Cpu',
    defaultHypothesis: '',
    defaultMethods:
      '## Model Description\n\n## Parameters\n- \n\n## Iterations / Runs\n\n## Convergence Criteria\n\n## Software / Packages\n',
    defaultVariables: [
      { name: 'Model parameter', type: 'independent', value: '', units: '' },
      { name: 'Output metric', type: 'dependent', value: '', units: '' },
      { name: 'Random seed', type: 'controlled', value: '42', units: '' },
    ],
    defaultObservations:
      '## Runtime Notes\n\n## Convergence Status\n\n## Computational Resources Used\n',
    defaultEquipment: ['HPC cluster', 'R / Python', 'Version control'],
  },
  custom: {
    label: 'Custom',
    description: 'Blank template -- fill in all fields manually',
    icon: 'PenTool',
    defaultHypothesis: '',
    defaultMethods: '',
    defaultVariables: [],
    defaultObservations: '',
    defaultEquipment: [],
  },
};

// ============================================
// Status Configuration
// ============================================

export const EXPERIMENT_STATUS_CONFIG: Record<
  ExperimentStatus,
  { label: string; color: string; bgColor: string }
> = {
  planning: {
    label: 'Planning',
    color: '#6366f1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
  },
  in_progress: {
    label: 'In Progress',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  complete: {
    label: 'Complete',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  archived: {
    label: 'Archived',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
  },
};

// ============================================
// Variable Type Configuration
// ============================================

export const VARIABLE_TYPE_CONFIG: Record<
  ExperimentVariable['type'],
  { label: string; color: string; bgColor: string }
> = {
  independent: {
    label: 'Independent',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  dependent: {
    label: 'Dependent',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  controlled: {
    label: 'Controlled',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
  },
};
