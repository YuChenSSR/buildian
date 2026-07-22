import type { ProviderUIOption } from '../../core/providers/types';

export const AMP_PROVIDER_ID = 'amp';
export const AMP_MODEL_ID = 'amp';
export const AMP_MODEL_LABEL = 'Amp';
export const AMP_CONTEXT_WINDOW = 200_000;

export type AmpAgentMode = 'low' | 'medium' | 'high' | 'ultra';

export const AMP_DEFAULT_MODE: AmpAgentMode = 'medium';
// Keep the default first because provider projection uses the first option as its fallback.
export const AMP_AGENT_MODES: readonly AmpAgentMode[] = ['medium', 'low', 'high', 'ultra'];

interface AmpModeDescriptor {
  description: string;
  label: string;
}

const AMP_MODE_DESCRIPTORS: Record<AmpAgentMode, AmpModeDescriptor> = {
  high: {
    description: 'Deep reasoning for hard tasks',
    label: 'Amp High',
  },
  low: {
    description: 'Fast, low-cost mode for small, well-defined tasks',
    label: 'Amp Low',
  },
  medium: {
    description: 'Balanced intelligence, speed, and cost for most tasks',
    label: 'Amp Medium',
  },
  ultra: {
    description: 'Most capable mode for hard, open-ended tasks',
    label: 'Amp Ultra',
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

export function buildAmpModelOptions(): ProviderUIOption[] {
  return AMP_AGENT_MODES.map((mode) => ({
    description: AMP_MODE_DESCRIPTORS[mode].description,
    label: AMP_MODE_DESCRIPTORS[mode].label,
    value: ampModelIdForMode(mode),
  }));
}
