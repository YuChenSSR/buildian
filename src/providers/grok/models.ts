import type { ProviderReasoningOption, ProviderUIOption } from '../../core/providers/types';

export interface GrokDiscoveredModel {
  contextWindow?: number;
  description?: string;
  label: string;
  rawId: string;
}

export const GROK_SYNTHETIC_MODEL_ID = 'grok';
export const GROK_DEFAULT_MODEL_ID = 'grok-build';
export const GROK_DEFAULT_REASONING_LEVEL = 'high';

const GROK_MODEL_PREFIX = 'grok:';
const GROK_REASONING_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const GROK_REASONING_LABELS: Record<typeof GROK_REASONING_LEVELS[number], string> = {
  high: 'High',
  low: 'Low',
  max: 'Max',
  medium: 'Medium',
  xhigh: 'XHigh',
};

export function isGrokModelSelectionId(model: string): boolean {
  return model === GROK_SYNTHETIC_MODEL_ID || model.startsWith(GROK_MODEL_PREFIX);
}

export function encodeGrokModelId(rawModelId: string): string {
  const normalized = rawModelId.trim();
  return normalized ? `${GROK_MODEL_PREFIX}${normalized}` : GROK_SYNTHETIC_MODEL_ID;
}

export function decodeGrokModelId(model: string): string | null {
  if (!model.startsWith(GROK_MODEL_PREFIX)) {
    return null;
  }

  const rawModelId = model.slice(GROK_MODEL_PREFIX.length).trim();
  return rawModelId || null;
}

export function normalizeGrokDiscoveredModels(value: unknown): GrokDiscoveredModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: GrokDiscoveredModel[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const rawId = getTrimmedString(record.rawId)
      ?? getTrimmedString(record.modelId)
      ?? getTrimmedString(record.id)
      ?? '';
    if (!rawId || seen.has(rawId)) {
      continue;
    }

    const label = getTrimmedString(record.label)
      ?? getTrimmedString(record.name)
      ?? rawId;
    const description = getTrimmedString(record.description);
    const contextWindow = normalizeContextWindow(record.contextWindow)
      ?? normalizeContextWindow(getRecord(record._meta).totalContextTokens);

    seen.add(rawId);
    normalized.push({
      ...(contextWindow ? { contextWindow } : {}),
      ...(description ? { description } : {}),
      label,
      rawId,
    });
  }

  return normalized;
}

export function normalizeGrokVisibleModels(
  value: unknown,
  discoveredModels: GrokDiscoveredModel[] = [],
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const knownIds = new Set(discoveredModels.map(model => model.rawId));
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const rawId = normalizeRawModelId(entry);
    if (!rawId || seen.has(rawId)) {
      continue;
    }
    if (knownIds.size > 0 && !knownIds.has(rawId)) {
      continue;
    }

    seen.add(rawId);
    normalized.push(rawId);
  }

  return normalized;
}

export function normalizeGrokReasoningLevel(value: unknown): string {
  if (typeof value !== 'string') {
    return GROK_DEFAULT_REASONING_LEVEL;
  }

  const normalized = value.trim().toLowerCase();
  return isGrokReasoningLevel(normalized) ? normalized : GROK_DEFAULT_REASONING_LEVEL;
}

export function getGrokReasoningOptions(): ProviderReasoningOption[] {
  return GROK_REASONING_LEVELS.map((level) => ({
    label: GROK_REASONING_LABELS[level],
    value: level,
  }));
}

export function buildGrokDefaultModelOptions(): ProviderUIOption[] {
  return [{
    description: 'xAI coding agent',
    label: 'Buildian default',
    value: encodeGrokModelId(GROK_DEFAULT_MODEL_ID),
  }];
}

export function normalizeRawModelId(value: string): string {
  const trimmed = value.trim();
  return decodeGrokModelId(trimmed) ?? (trimmed === GROK_SYNTHETIC_MODEL_ID ? '' : trimmed);
}

function isGrokReasoningLevel(value: string): value is typeof GROK_REASONING_LEVELS[number] {
  return (GROK_REASONING_LEVELS as readonly string[]).includes(value);
}

function normalizeContextWindow(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
