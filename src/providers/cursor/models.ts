import type { ProviderReasoningOption, ProviderUIOption } from '../../core/providers/types';

export interface CursorDiscoveredModel {
  contextWindow?: number;
  description?: string;
  label: string;
  rawId: string;
}

export const CURSOR_PROVIDER_ID = 'cursor-agent';
export const CURSOR_SYNTHETIC_MODEL_ID = CURSOR_PROVIDER_ID;
export const CURSOR_LEGACY_AUTO_MODEL_ID = 'default[]';
export const CURSOR_DEFAULT_MODEL_ID = 'claude-4.6-opus-max-thinking';
export const CURSOR_DEFAULT_REASONING_LEVEL = 'max';

const CURSOR_MODEL_PREFIX = `${CURSOR_PROVIDER_ID}:`;
const CURSOR_REASONING_LEVELS = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'extra-high',
  'max',
] as const;
const CURSOR_REASONING_LABELS: Record<typeof CURSOR_REASONING_LEVELS[number], string> = {
  'extra-high': 'Extra High',
  high: 'High',
  low: 'Low',
  max: 'Max',
  medium: 'Medium',
  none: 'None',
  xhigh: 'XHigh',
};

export function isCursorModelSelectionId(model: string): boolean {
  return model === CURSOR_SYNTHETIC_MODEL_ID || model.startsWith(CURSOR_MODEL_PREFIX);
}

export function encodeCursorModelId(rawModelId: string): string {
  const normalized = rawModelId.trim();
  return normalized ? `${CURSOR_MODEL_PREFIX}${normalized}` : CURSOR_SYNTHETIC_MODEL_ID;
}

export function decodeCursorModelId(model: string): string | null {
  if (!model.startsWith(CURSOR_MODEL_PREFIX)) {
    return null;
  }

  const rawModelId = model.slice(CURSOR_MODEL_PREFIX.length).trim();
  return rawModelId || null;
}

export function normalizeCursorDiscoveredModels(value: unknown): CursorDiscoveredModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: CursorDiscoveredModel[] = [];
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

export function normalizeCursorVisibleModels(
  value: unknown,
  discoveredModels: CursorDiscoveredModel[] = [],
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
    if (knownIds.size > 0 && !knownIds.has(rawId) && rawId !== CURSOR_DEFAULT_MODEL_ID) {
      continue;
    }

    seen.add(rawId);
    normalized.push(rawId);
  }

  return normalized;
}

export function normalizeCursorReasoningLevel(value: unknown): string {
  if (typeof value !== 'string') {
    return CURSOR_DEFAULT_REASONING_LEVEL;
  }

  const normalized = value.trim().toLowerCase();
  return isCursorReasoningLevel(normalized) ? normalized : CURSOR_DEFAULT_REASONING_LEVEL;
}

export function getCursorReasoningOptions(): ProviderReasoningOption[] {
  return CURSOR_REASONING_LEVELS.map((level) => ({
    label: CURSOR_REASONING_LABELS[level],
    value: level,
  }));
}

export function buildCursorDefaultModelOptions(): ProviderUIOption[] {
  return [{
    description: 'Cursor Agent default model',
    label: 'Opus 4.6 Max Thinking',
    value: encodeCursorModelId(CURSOR_DEFAULT_MODEL_ID),
  }];
}

export function normalizeRawModelId(value: string): string {
  const trimmed = value.trim();
  const rawId = decodeCursorModelId(trimmed) ?? (trimmed === CURSOR_SYNTHETIC_MODEL_ID ? '' : trimmed);
  return rawId === CURSOR_LEGACY_AUTO_MODEL_ID ? CURSOR_DEFAULT_MODEL_ID : rawId;
}

export function extractCursorReasoningLevel(rawModelId: string): string | null {
  const params = parseCursorModelParameters(rawModelId);
  return normalizeOptionalCursorReasoningLevel(params.get('effort') ?? params.get('reasoning'))
    ?? extractCursorPublicReasoningLevel(rawModelId);
}

export function applyCursorReasoningLevel(rawModelId: string, effort: string): string {
  const normalizedEffort = normalizeCursorReasoningLevel(effort);
  if (rawModelId.trim() === CURSOR_LEGACY_AUTO_MODEL_ID) {
    return applyCursorPublicReasoningLevel(CURSOR_DEFAULT_MODEL_ID, normalizedEffort);
  }

  const bracketStart = rawModelId.indexOf('[');
  const bracketEnd = rawModelId.endsWith(']') ? rawModelId.length - 1 : -1;
  if (bracketStart <= 0 || bracketEnd <= bracketStart) {
    return applyCursorPublicReasoningLevel(rawModelId, normalizedEffort);
  }

  const head = rawModelId.slice(0, bracketStart);
  const entries = rawModelId
    .slice(bracketStart + 1, bracketEnd)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
  let didUpdate = false;
  const nextEntries = entries.map((entry) => {
    const equalsIndex = entry.indexOf('=');
    if (equalsIndex <= 0) {
      return entry;
    }

    const key = entry.slice(0, equalsIndex).trim();
    if (key !== 'effort' && key !== 'reasoning') {
      return entry;
    }

    didUpdate = true;
    return `${key}=${normalizedEffort}`;
  });

  return didUpdate ? `${head}[${nextEntries.join(',')}]` : rawModelId;
}

export function resolveCursorCliModelId(rawModelId: string, effort: unknown): string | null {
  const normalizedRawId = rawModelId.trim();
  if (!normalizedRawId || normalizedRawId === CURSOR_LEGACY_AUTO_MODEL_ID) {
    return applyCursorPublicReasoningLevel(
      CURSOR_DEFAULT_MODEL_ID,
      normalizeCursorReasoningLevel(effort),
    );
  }

  const normalizedEffort = normalizeCursorReasoningLevel(effort);
  const publicModelId = buildCursorPublicModelIdFromAcpId(normalizedRawId, normalizedEffort);
  return publicModelId ?? applyCursorReasoningLevel(normalizedRawId, normalizedEffort);
}

export function shouldPassCursorModelToCli(rawModelId: string | null | undefined): boolean {
  if (!rawModelId) {
    return false;
  }

  const trimmed = rawModelId.trim();
  return Boolean(trimmed)
    && trimmed !== CURSOR_LEGACY_AUTO_MODEL_ID
    && !(trimmed.includes('[') && trimmed.endsWith(']'));
}

function normalizeOptionalCursorReasoningLevel(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isCursorReasoningLevel(normalized) ? normalized : null;
}

function isCursorReasoningLevel(value: string): value is typeof CURSOR_REASONING_LEVELS[number] {
  return (CURSOR_REASONING_LEVELS as readonly string[]).includes(value);
}

function parseCursorModelParameters(rawModelId: string): Map<string, string> {
  const bracketStart = rawModelId.indexOf('[');
  const bracketEnd = rawModelId.endsWith(']') ? rawModelId.length - 1 : -1;
  if (bracketStart < 0 || bracketEnd <= bracketStart) {
    return new Map();
  }

  const params = new Map<string, string>();
  for (const entry of rawModelId.slice(bracketStart + 1, bracketEnd).split(',')) {
    const equalsIndex = entry.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, equalsIndex).trim().toLowerCase();
    const value = entry.slice(equalsIndex + 1).trim();
    if (key && value) {
      params.set(key, value);
    }
  }
  return params;
}

function buildCursorPublicModelIdFromAcpId(
  rawModelId: string,
  effort: string,
): string | null {
  const bracketStart = rawModelId.indexOf('[');
  const bracketEnd = rawModelId.endsWith(']') ? rawModelId.length - 1 : -1;
  if (bracketStart <= 0 || bracketEnd <= bracketStart) {
    return null;
  }

  const acpBase = rawModelId.slice(0, bracketStart);
  const params = parseCursorModelParameters(rawModelId);
  const thinking = params.get('thinking')?.toLowerCase() === 'true';
  const fast = params.get('fast')?.toLowerCase() === 'true';
  const publicBase = normalizeCursorPublicBaseModelId(acpBase);
  if (!publicBase) {
    return null;
  }

  const publicEffort = normalizeCursorPublicEffort(effort);
  const fastSuffix = fast ? '-fast' : '';
  if (publicBase === 'claude-4.6-opus') {
    if (publicEffort !== 'high' && publicEffort !== 'max') {
      return null;
    }
    return thinking
      ? `${publicBase}-${publicEffort}-thinking${fastSuffix}`
      : `${publicBase}-${publicEffort}${fastSuffix}`;
  }

  if (publicBase === 'claude-4.6-sonnet') {
    if (publicEffort !== 'medium') {
      return null;
    }
    return thinking
      ? `${publicBase}-${publicEffort}-thinking${fastSuffix}`
      : `${publicBase}-${publicEffort}${fastSuffix}`;
  }

  if (
    publicBase.startsWith('claude-opus-')
    || publicBase.startsWith('claude-fable-')
  ) {
    return thinking
      ? `${publicBase}-thinking-${publicEffort}${fastSuffix}`
      : `${publicBase}-${publicEffort}${fastSuffix}`;
  }

  if (publicBase.startsWith('gpt-')) {
    return `${publicBase}-${publicEffort}${fastSuffix}`;
  }

  return null;
}

function normalizeCursorPublicBaseModelId(acpBase: string): string | null {
  const opus46Match = acpBase.match(/^claude-opus-4-6$/);
  if (opus46Match) {
    return 'claude-4.6-opus';
  }

  const sonnet46Match = acpBase.match(/^claude-sonnet-4-6$/);
  if (sonnet46Match) {
    return 'claude-4.6-sonnet';
  }

  if (
    /^claude-opus-4-[78]$/.test(acpBase)
    || acpBase.startsWith('claude-fable-')
    || acpBase.startsWith('gpt-')
  ) {
    return acpBase;
  }

  return null;
}

function applyCursorPublicReasoningLevel(rawModelId: string, effort: string): string {
  const trimmed = rawModelId.trim();
  if (!trimmed || trimmed.includes('[')) {
    return rawModelId;
  }

  const publicEffort = normalizeCursorPublicEffort(effort);
  const effortPattern = /-(extra-high|xhigh|max|high|medium|low|none)(?=-|$)/;
  return effortPattern.test(trimmed)
    ? trimmed.replace(effortPattern, `-${publicEffort}`)
    : trimmed;
}

function extractCursorPublicReasoningLevel(rawModelId: string): string | null {
  if (!rawModelId.trim() || rawModelId.includes('[')) {
    return null;
  }

  const match = rawModelId.match(/-(extra-high|xhigh|max|high|medium|low|none)(?=-|$)/);
  return normalizeOptionalCursorReasoningLevel(match?.[1]);
}

function normalizeCursorPublicEffort(effort: string): string {
  return effort === 'extra-high' ? 'xhigh' : effort;
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
