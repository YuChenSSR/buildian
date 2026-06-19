import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import { DroidCommandCatalog } from '../commands/DroidCommandCatalog';
import { DROID_PROVIDER_ID } from '../models';
import { DroidCliResolver } from '../runtime/DroidCliResolver';
import { droidSettingsTabRenderer } from '../ui/DroidSettingsTab';
import { DroidRuntimeCommandLoader } from './DroidRuntimeCommandLoader';

export interface DroidWorkspaceServices extends ProviderWorkspaceServices {
  commandCatalog: ProviderCommandCatalog;
}

const droidTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'commands';
  },
};

export async function createDroidWorkspaceServices(): Promise<DroidWorkspaceServices> {
  return {
    cliResolver: new DroidCliResolver(),
    commandCatalog: new DroidCommandCatalog(),
    runtimeCommandLoader: new DroidRuntimeCommandLoader(),
    settingsTabRenderer: droidSettingsTabRenderer,
    tabWarmupPolicy: droidTabWarmupPolicy,
  };
}

export const droidWorkspaceRegistration: ProviderWorkspaceRegistration<DroidWorkspaceServices> = {
  initialize: async () => createDroidWorkspaceServices(),
};

export function maybeGetDroidWorkspaceServices(): DroidWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices(DROID_PROVIDER_ID) as DroidWorkspaceServices | null;
}
