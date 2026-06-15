import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';
import {
  getHostnameKey,
  getLegacyHostnameKey,
  migrateLegacyHostnameKeyedMap,
} from '../../utils/env';
import {
  CURSOR_DEFAULT_MODEL_ID,
  CURSOR_DEFAULT_REASONING_LEVEL,
  CURSOR_PROVIDER_ID,
  type CursorDiscoveredModel,
  normalizeCursorDiscoveredModels,
  normalizeCursorReasoningLevel,
  normalizeCursorVisibleModels,
  normalizeRawModelId,
} from './models';

export interface CursorProviderSettings {
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  discoveredModels: CursorDiscoveredModel[];
  enabled: boolean;
  environmentHash: string;
  environmentVariables: string;
  modelAliases: Record<string, string>;
  preferredEffortByModel: Record<string, string>;
  visibleModels: string[];
}

export const DEFAULT_CURSOR_PROVIDER_SETTINGS: Readonly<CursorProviderSettings> = Object.freeze({
  cliPath: '',
  cliPathsByHost: {},
  discoveredModels: [],
  enabled: false,
  environmentHash: '',
  environmentVariables: '',
  modelAliases: {},
  preferredEffortByModel: {},
  visibleModels: [],
});

export function getCursorProviderSettings(settings: Record<string, unknown>): CursorProviderSettings {
  const config = getProviderConfig(settings, CURSOR_PROVIDER_ID);
  const normalizedCliPathsByHost = normalizeHostnameCliPaths(config.cliPathsByHost);
  const cliPathsByHost = Object.keys(normalizedCliPathsByHost).length > 0
    ? migrateLegacyHostnameKeyedMap(
      normalizedCliPathsByHost,
      getHostnameKey(),
      getLegacyHostnameKey(),
    )
    : normalizedCliPathsByHost;
  const discoveredModels = normalizeCursorDiscoveredModels(config.discoveredModels);

  return {
    cliPath: typeof config.cliPath === 'string'
      ? config.cliPath
      : DEFAULT_CURSOR_PROVIDER_SETTINGS.cliPath,
    cliPathsByHost,
    discoveredModels,
    enabled: typeof config.enabled === 'boolean'
      ? config.enabled
      : DEFAULT_CURSOR_PROVIDER_SETTINGS.enabled,
    environmentHash: typeof config.environmentHash === 'string'
      ? config.environmentHash
      : DEFAULT_CURSOR_PROVIDER_SETTINGS.environmentHash,
    environmentVariables: typeof config.environmentVariables === 'string'
      ? config.environmentVariables
      : getProviderEnvironmentVariables(settings, CURSOR_PROVIDER_ID)
        ?? DEFAULT_CURSOR_PROVIDER_SETTINGS.environmentVariables,
    modelAliases: normalizeCursorModelAliases(config.modelAliases, discoveredModels),
    preferredEffortByModel: normalizeCursorPreferredEffortByModel(
      config.preferredEffortByModel,
      discoveredModels,
    ),
    visibleModels: normalizeCursorVisibleModels(config.visibleModels, discoveredModels),
  };
}

export function updateCursorProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<CursorProviderSettings>,
): CursorProviderSettings {
  const current = getCursorProviderSettings(settings);
  const hostnameKey = getHostnameKey();
  const nextDiscoveredModels = normalizeCursorDiscoveredModels(
    updates.discoveredModels ?? current.discoveredModels,
  );
  const nextVisibleModels = normalizeCursorVisibleModels(
    updates.visibleModels ?? current.visibleModels,
    nextDiscoveredModels,
  );
  const nextCliPathsByHost = 'cliPathsByHost' in updates
    ? normalizeHostnameCliPaths(updates.cliPathsByHost)
    : { ...current.cliPathsByHost };
  let nextCliPath = 'cliPathsByHost' in updates
    ? (
      typeof updates.cliPath === 'string'
        ? updates.cliPath.trim()
        : DEFAULT_CURSOR_PROVIDER_SETTINGS.cliPath
    )
    : current.cliPath.trim();

  if ('cliPath' in updates && !('cliPathsByHost' in updates)) {
    const trimmedCliPath = typeof updates.cliPath === 'string' ? updates.cliPath.trim() : '';
    if (trimmedCliPath) {
      nextCliPathsByHost[hostnameKey] = trimmedCliPath;
    } else {
      delete nextCliPathsByHost[hostnameKey];
    }
    nextCliPath = DEFAULT_CURSOR_PROVIDER_SETTINGS.cliPath;
  }

  const next: CursorProviderSettings = {
    ...current,
    ...updates,
    cliPath: nextCliPath,
    cliPathsByHost: nextCliPathsByHost,
    discoveredModels: nextDiscoveredModels,
    modelAliases: pruneStringMapToModels(
      normalizeCursorModelAliases(updates.modelAliases ?? current.modelAliases, nextDiscoveredModels),
      nextVisibleModels,
    ),
    preferredEffortByModel: pruneStringMapToModels(
      normalizeCursorPreferredEffortByModel(
        updates.preferredEffortByModel ?? current.preferredEffortByModel,
        nextDiscoveredModels,
      ),
      nextVisibleModels,
    ),
    visibleModels: nextVisibleModels,
  };

  setProviderConfig(settings, CURSOR_PROVIDER_ID, {
    cliPath: next.cliPath,
    cliPathsByHost: next.cliPathsByHost,
    discoveredModels: next.discoveredModels,
    enabled: next.enabled,
    environmentHash: next.environmentHash,
    environmentVariables: next.environmentVariables,
    modelAliases: next.modelAliases,
    preferredEffortByModel: next.preferredEffortByModel,
    visibleModels: next.visibleModels,
  });

  return next;
}

export function resolveCursorModelAlias(
  settings: CursorProviderSettings,
  rawId: string,
): string | null {
  return settings.modelAliases[rawId] ?? null;
}

function normalizeHostnameCliPaths(value: unknown): HostnameCliPaths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: HostnameCliPaths = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim()) {
      result[key] = entry.trim();
    }
  }
  return result;
}

function normalizeCursorModelAliases(
  value: unknown,
  discoveredModels: CursorDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const knownIds = new Set(discoveredModels.map(model => model.rawId));
  const normalized: Record<string, string> = {};
  for (const [key, alias] of Object.entries(value as Record<string, unknown>)) {
    if (typeof alias !== 'string') {
      continue;
    }

    const rawId = normalizeRawModelId(key);
    const normalizedAlias = alias.trim();
    if (
      !rawId
      || !normalizedAlias
      || (knownIds.size > 0 && !knownIds.has(rawId) && rawId !== CURSOR_DEFAULT_MODEL_ID)
    ) {
      continue;
    }

    normalized[rawId] = normalizedAlias;
  }

  return normalized;
}

function normalizeCursorPreferredEffortByModel(
  value: unknown,
  discoveredModels: CursorDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const knownIds = new Set(discoveredModels.map(model => model.rawId));
  const normalized: Record<string, string> = {};
  for (const [key, effort] of Object.entries(value as Record<string, unknown>)) {
    const rawId = normalizeRawModelId(key);
    if (!rawId || (knownIds.size > 0 && !knownIds.has(rawId) && rawId !== CURSOR_DEFAULT_MODEL_ID)) {
      continue;
    }

    const normalizedEffort = normalizeCursorReasoningLevel(effort);
    if (normalizedEffort !== CURSOR_DEFAULT_REASONING_LEVEL) {
      normalized[rawId] = normalizedEffort;
    }
  }

  return normalized;
}

function pruneStringMapToModels(
  value: Record<string, string>,
  visibleModels: string[],
): Record<string, string> {
  if (visibleModels.length === 0) {
    return {};
  }

  const visible = new Set(visibleModels);
  const pruned: Record<string, string> = {};
  for (const [rawId, entry] of Object.entries(value)) {
    if (visible.has(rawId)) {
      pruned[rawId] = entry;
    }
  }
  return pruned;
}
