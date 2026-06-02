import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';
import {
  getHostnameKey,
  getLegacyHostnameKey,
  migrateLegacyHostnameKeyedMap,
} from '../../utils/env';
import {
  GROK_DEFAULT_REASONING_LEVEL,
  type GrokDiscoveredModel,
  normalizeGrokDiscoveredModels,
  normalizeGrokReasoningLevel,
  normalizeGrokVisibleModels,
  normalizeRawModelId,
} from './models';

export interface GrokProviderSettings {
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  discoveredModels: GrokDiscoveredModel[];
  enabled: boolean;
  environmentHash: string;
  environmentVariables: string;
  modelAliases: Record<string, string>;
  preferredEffortByModel: Record<string, string>;
  visibleModels: string[];
}

export const DEFAULT_GROK_PROVIDER_SETTINGS: Readonly<GrokProviderSettings> = Object.freeze({
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

export function getGrokProviderSettings(settings: Record<string, unknown>): GrokProviderSettings {
  const config = getProviderConfig(settings, 'grok');
  const normalizedCliPathsByHost = normalizeHostnameCliPaths(config.cliPathsByHost);
  const cliPathsByHost = Object.keys(normalizedCliPathsByHost).length > 0
    ? migrateLegacyHostnameKeyedMap(
      normalizedCliPathsByHost,
      getHostnameKey(),
      getLegacyHostnameKey(),
    )
    : normalizedCliPathsByHost;
  const discoveredModels = normalizeGrokDiscoveredModels(config.discoveredModels);

  return {
    cliPath: typeof config.cliPath === 'string'
      ? config.cliPath
      : DEFAULT_GROK_PROVIDER_SETTINGS.cliPath,
    cliPathsByHost,
    discoveredModels,
    enabled: typeof config.enabled === 'boolean'
      ? config.enabled
      : DEFAULT_GROK_PROVIDER_SETTINGS.enabled,
    environmentHash: typeof config.environmentHash === 'string'
      ? config.environmentHash
      : DEFAULT_GROK_PROVIDER_SETTINGS.environmentHash,
    environmentVariables: typeof config.environmentVariables === 'string'
      ? config.environmentVariables
      : getProviderEnvironmentVariables(settings, 'grok')
        ?? DEFAULT_GROK_PROVIDER_SETTINGS.environmentVariables,
    modelAliases: normalizeGrokModelAliases(config.modelAliases, discoveredModels),
    preferredEffortByModel: normalizeGrokPreferredEffortByModel(
      config.preferredEffortByModel,
      discoveredModels,
    ),
    visibleModels: normalizeGrokVisibleModels(config.visibleModels, discoveredModels),
  };
}

export function updateGrokProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<GrokProviderSettings>,
): GrokProviderSettings {
  const current = getGrokProviderSettings(settings);
  const hostnameKey = getHostnameKey();
  const nextDiscoveredModels = normalizeGrokDiscoveredModels(
    updates.discoveredModels ?? current.discoveredModels,
  );
  const nextVisibleModels = normalizeGrokVisibleModels(
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
        : DEFAULT_GROK_PROVIDER_SETTINGS.cliPath
    )
    : current.cliPath.trim();

  if ('cliPath' in updates && !('cliPathsByHost' in updates)) {
    const trimmedCliPath = typeof updates.cliPath === 'string' ? updates.cliPath.trim() : '';
    if (trimmedCliPath) {
      nextCliPathsByHost[hostnameKey] = trimmedCliPath;
    } else {
      delete nextCliPathsByHost[hostnameKey];
    }
    nextCliPath = DEFAULT_GROK_PROVIDER_SETTINGS.cliPath;
  }

  const next: GrokProviderSettings = {
    ...current,
    ...updates,
    cliPath: nextCliPath,
    cliPathsByHost: nextCliPathsByHost,
    discoveredModels: nextDiscoveredModels,
    modelAliases: pruneStringMapToModels(
      normalizeGrokModelAliases(updates.modelAliases ?? current.modelAliases, nextDiscoveredModels),
      nextVisibleModels,
    ),
    preferredEffortByModel: pruneStringMapToModels(
      normalizeGrokPreferredEffortByModel(
        updates.preferredEffortByModel ?? current.preferredEffortByModel,
        nextDiscoveredModels,
      ),
      nextVisibleModels,
    ),
    visibleModels: nextVisibleModels,
  };

  setProviderConfig(settings, 'grok', {
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

export function resolveGrokModelAlias(
  settings: GrokProviderSettings,
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

function normalizeGrokModelAliases(
  value: unknown,
  discoveredModels: GrokDiscoveredModel[] = [],
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
    if (!rawId || !normalizedAlias || (knownIds.size > 0 && !knownIds.has(rawId))) {
      continue;
    }

    normalized[rawId] = normalizedAlias;
  }

  return normalized;
}

function normalizeGrokPreferredEffortByModel(
  value: unknown,
  discoveredModels: GrokDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const knownIds = new Set(discoveredModels.map(model => model.rawId));
  const normalized: Record<string, string> = {};
  for (const [key, effort] of Object.entries(value as Record<string, unknown>)) {
    const rawId = normalizeRawModelId(key);
    if (!rawId || (knownIds.size > 0 && !knownIds.has(rawId))) {
      continue;
    }

    const normalizedEffort = normalizeGrokReasoningLevel(effort);
    if (normalizedEffort !== GROK_DEFAULT_REASONING_LEVEL) {
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
