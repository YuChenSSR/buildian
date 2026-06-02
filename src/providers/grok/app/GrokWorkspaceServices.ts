import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import { GrokCommandCatalog } from '../commands/GrokCommandCatalog';
import { GrokCliResolver } from '../runtime/GrokCliResolver';
import { grokSettingsTabRenderer } from '../ui/GrokSettingsTab';
import { GrokRuntimeCommandLoader } from './GrokRuntimeCommandLoader';

export interface GrokWorkspaceServices extends ProviderWorkspaceServices {
  commandCatalog: ProviderCommandCatalog;
}

const grokTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'commands';
  },
};

export async function createGrokWorkspaceServices(): Promise<GrokWorkspaceServices> {
  return {
    cliResolver: new GrokCliResolver(),
    commandCatalog: new GrokCommandCatalog(),
    runtimeCommandLoader: new GrokRuntimeCommandLoader(),
    settingsTabRenderer: grokSettingsTabRenderer,
    tabWarmupPolicy: grokTabWarmupPolicy,
  };
}

export const grokWorkspaceRegistration: ProviderWorkspaceRegistration<GrokWorkspaceServices> = {
  initialize: async () => createGrokWorkspaceServices(),
};

export function maybeGetGrokWorkspaceServices(): GrokWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('grok') as GrokWorkspaceServices | null;
}
