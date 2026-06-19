import type { ProviderReasoningOption, ProviderUIOption } from '../../core/providers/types';

export interface DroidDiscoveredModel {
  contextWindow?: number;
  description?: string;
  label: string;
  rawId: string;
}

export const DROID_PROVIDER_ID = 'droid';
export const DROID_SYNTHETIC_MODEL_ID = DROID_PROVIDER_ID;
export const DROID_DEFAULT_MODEL_ID = 'default';
export const DROID_DEFAULT_REASONING_LEVEL = 'low';

const DROID_MODEL_PREFIX = `${DROID_PROVIDER_ID}:`;
const DROID_REASONING_LEVELS = ['off', 'low', 'medium', 'high'] as const;
const DROID_REASONING_LABELS: Record<typeof DROID_REASONING_LEVELS[number], string> = {
  high: 'High',
  low: 'Low',
  medium: 'Medium',
  off: 'Off',
};

export function isDroidModelSelectionId(model: string): boolean {
  return model === DROID_SYNTHETIC_MODEL_ID || model.startsWith(DROID_MODEL_PREFIX);
}

export function encodeDroidModelId(rawModelId: string): string {
  const normalized = normalizeRawModelId(rawModelId);
  return normalized ? `${DROID_MODEL_PREFIX}${normalized}` : DROID_SYNTHETIC_MODEL_ID;
}

export function decodeDroidModelId(model: string): string | null {
  if (!model.startsWith(DROID_MODEL_PREFIX)) {
    return null;
  }

  const rawModelId = model.slice(DROID_MODEL_PREFIX.length).trim();
  return rawModelId || null;
}

export function normalizeDroidDiscoveredModels(value: unknown): DroidDiscoveredModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: DroidDiscoveredModel[] = [];
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
      ?? normalizeContextWindow(getRecord(record._meta).totalContextTokens)
      ?? parseContextWindowFromModelId(rawId);

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

export function normalizeDroidVisibleModels(
  value: unknown,
  discoveredModels: DroidDiscoveredModel[] = [],
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
    if (knownIds.size > 0 && !knownIds.has(rawId) && rawId !== DROID_DEFAULT_MODEL_ID) {
      continue;
    }

    seen.add(rawId);
    normalized.push(rawId);
  }

  return normalized;
}

export function normalizeDroidReasoningLevel(value: unknown): string {
  if (typeof value !== 'string') {
    return DROID_DEFAULT_REASONING_LEVEL;
  }

  const normalized = value.trim().toLowerCase();
  return isDroidReasoningLevel(normalized) ? normalized : DROID_DEFAULT_REASONING_LEVEL;
}

export function getDroidReasoningOptions(): ProviderReasoningOption[] {
  return DROID_REASONING_LEVELS.map((level) => ({
    label: DROID_REASONING_LABELS[level],
    value: level,
  }));
}

export function buildDroidDefaultModelOptions(): ProviderUIOption[] {
  return [{
    description: 'Factory Droid CLI default model',
    label: 'Droid default',
    value: encodeDroidModelId(DROID_DEFAULT_MODEL_ID),
  }];
}

export function normalizeRawModelId(value: string): string {
  const trimmed = value.trim();
  return decodeDroidModelId(trimmed)
    ?? (trimmed === DROID_SYNTHETIC_MODEL_ID || !trimmed ? DROID_DEFAULT_MODEL_ID : trimmed);
}

export function resolveDroidCliModelId(rawModelId: string | null | undefined): string | null {
  const normalizedRawId = rawModelId ? normalizeRawModelId(rawModelId) : DROID_DEFAULT_MODEL_ID;
  return normalizedRawId === DROID_DEFAULT_MODEL_ID ? null : normalizedRawId;
}

export function shouldPassDroidModelToCli(rawModelId: string | null | undefined): boolean {
  return resolveDroidCliModelId(rawModelId) !== null;
}

function isDroidReasoningLevel(value: string): value is typeof DROID_REASONING_LEVELS[number] {
  return (DROID_REASONING_LEVELS as readonly string[]).includes(value);
}

function normalizeContextWindow(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

function parseContextWindowFromModelId(rawId: string): number | undefined {
  const match = rawId.match(/(?:^|[,[])\s*context\s*=\s*(\d+)\s*k\b/i);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value * 1000 : undefined;
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
