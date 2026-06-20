import type { ProviderReasoningOption, ProviderUIOption } from '../../core/providers/types';

export const AMP_PROVIDER_ID = 'amp';
export const AMP_MODEL_ID = 'amp';
export const AMP_MODEL_LABEL = 'Amp';
export const AMP_CONTEXT_WINDOW = 200_000;

export type AmpAgentMode = 'smart' | 'deep' | 'rush';

export const AMP_DEFAULT_MODE: AmpAgentMode = 'smart';
export const AMP_AGENT_MODES: readonly AmpAgentMode[] = ['smart', 'deep', 'rush'];

// Reasoning effort ladder accepted by `amp --effort` (see `amp --help`):
// none, minimal, low, medium, high, xhigh, max.
const AMP_EFFORT_LADDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const AMP_EFFORT_LABELS: Record<string, string> = {
  high: 'High',
  low: 'Low',
  max: 'Max',
  medium: 'Medium',
  minimal: 'Minimal',
  none: 'None',
  xhigh: 'XHigh',
};

interface AmpModeDescriptor {
  defaultEffort: string;
  description: string;
  effortLevels: readonly string[];
  label: string;
}

// `amp --mode` exposes smart/deep/rush; `deep` is an experimental mode that the
// user must enable via `amp.experimental.modes`. Reasoning effort is only
// honored by modes that advertise it (smart/deep), so `rush` carries no levels.
const AMP_MODE_DESCRIPTORS: Record<AmpAgentMode, AmpModeDescriptor> = {
  deep: {
    defaultEffort: 'high',
    description: 'Deepest reasoning (experimental — enable "deep" in Amp settings)',
    effortLevels: AMP_EFFORT_LADDER,
    label: 'Amp Deep',
  },
  rush: {
    defaultEffort: '',
    description: 'Fastest, minimal reasoning',
    effortLevels: [],
    label: 'Amp Rush',
  },
  smart: {
    defaultEffort: 'medium',
    description: 'Balanced default mode',
    effortLevels: AMP_EFFORT_LADDER,
    label: 'Amp Smart',
  },
};

const AMP_MODE_PREFIX = `${AMP_PROVIDER_ID}:`;

export function ampModelIdForMode(mode: AmpAgentMode): string {
  return mode === AMP_DEFAULT_MODE ? AMP_MODEL_ID : `${AMP_MODE_PREFIX}${mode}`;
}

export function ampModeFromModelId(model: string | null | undefined): AmpAgentMode | null {
  const trimmed = typeof model === 'string' ? model.trim().toLowerCase() : '';
  if (
    !trimmed
    || trimmed === AMP_PROVIDER_ID
    || trimmed === AMP_MODEL_ID
    || trimmed === `${AMP_MODE_PREFIX}default`
    || trimmed === `${AMP_MODE_PREFIX}${AMP_MODEL_ID}`
  ) {
    return AMP_DEFAULT_MODE;
  }
  if (trimmed.startsWith(AMP_MODE_PREFIX)) {
    const candidate = trimmed.slice(AMP_MODE_PREFIX.length);
    if ((AMP_AGENT_MODES as readonly string[]).includes(candidate)) {
      return candidate as AmpAgentMode;
    }
  }
  return null;
}

export function isAmpModelSelectionId(model: string): boolean {
  return ampModeFromModelId(model) !== null;
}

export function normalizeAmpModelId(model: string | null | undefined): string {
  const mode = ampModeFromModelId(model);
  if (mode) {
    return ampModelIdForMode(mode);
  }
  const trimmed = typeof model === 'string' ? model.trim() : '';
  return trimmed || AMP_MODEL_ID;
}

export function resolveAmpAgentMode(model: string | null | undefined): AmpAgentMode {
  return ampModeFromModelId(model) ?? AMP_DEFAULT_MODE;
}

export function ampModeSupportsEffort(mode: AmpAgentMode): boolean {
  return AMP_MODE_DESCRIPTORS[mode].effortLevels.length > 0;
}

export function buildAmpModelOptions(): ProviderUIOption[] {
  return AMP_AGENT_MODES.map((mode) => ({
    description: AMP_MODE_DESCRIPTORS[mode].description,
    label: AMP_MODE_DESCRIPTORS[mode].label,
    value: ampModelIdForMode(mode),
  }));
}

export function getAmpReasoningOptions(model: string): ProviderReasoningOption[] {
  return AMP_MODE_DESCRIPTORS[resolveAmpAgentMode(model)].effortLevels.map((level) => ({
    label: AMP_EFFORT_LABELS[level] ?? level,
    value: level,
  }));
}

export function getAmpDefaultEffort(model: string): string {
  return AMP_MODE_DESCRIPTORS[resolveAmpAgentMode(model)].defaultEffort;
}

export function normalizeAmpEffort(model: string, value: unknown): string {
  const descriptor = AMP_MODE_DESCRIPTORS[resolveAmpAgentMode(model)];
  if (descriptor.effortLevels.length === 0) {
    return '';
  }
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (descriptor.effortLevels as readonly string[]).includes(normalized)
    ? normalized
    : descriptor.defaultEffort;
}
