import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import { AmpCommandCatalog } from '../commands/AmpCommandCatalog';
import { AMP_PROVIDER_ID } from '../models';
import { AmpCliResolver } from '../runtime/AmpCliResolver';
import { ampSettingsTabRenderer } from '../ui/AmpSettingsTab';
import { AmpRuntimeCommandLoader } from './AmpRuntimeCommandLoader';

export interface AmpWorkspaceServices extends ProviderWorkspaceServices {
  commandCatalog: ProviderCommandCatalog;
}

const ampTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'commands';
  },
};

export async function createAmpWorkspaceServices(): Promise<AmpWorkspaceServices> {
  return {
    cliResolver: new AmpCliResolver(),
    commandCatalog: new AmpCommandCatalog(),
    runtimeCommandLoader: new AmpRuntimeCommandLoader(),
    settingsTabRenderer: ampSettingsTabRenderer,
    tabWarmupPolicy: ampTabWarmupPolicy,
  };
}

export const ampWorkspaceRegistration: ProviderWorkspaceRegistration<AmpWorkspaceServices> = {
  initialize: async () => createAmpWorkspaceServices(),
};

export function maybeGetAmpWorkspaceServices(): AmpWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices(AMP_PROVIDER_ID) as AmpWorkspaceServices | null;
}
