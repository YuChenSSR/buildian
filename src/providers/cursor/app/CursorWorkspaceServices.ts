import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import { CursorCommandCatalog } from '../commands/CursorCommandCatalog';
import { CURSOR_PROVIDER_ID } from '../models';
import { CursorCliResolver } from '../runtime/CursorCliResolver';
import { cursorSettingsTabRenderer } from '../ui/CursorSettingsTab';
import { CursorRuntimeCommandLoader } from './CursorRuntimeCommandLoader';

export interface CursorWorkspaceServices extends ProviderWorkspaceServices {
  commandCatalog: ProviderCommandCatalog;
}

const cursorTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'commands';
  },
};

export async function createCursorWorkspaceServices(): Promise<CursorWorkspaceServices> {
  return {
    cliResolver: new CursorCliResolver(),
    commandCatalog: new CursorCommandCatalog(),
    runtimeCommandLoader: new CursorRuntimeCommandLoader(),
    settingsTabRenderer: cursorSettingsTabRenderer,
    tabWarmupPolicy: cursorTabWarmupPolicy,
  };
}

export const cursorWorkspaceRegistration: ProviderWorkspaceRegistration<CursorWorkspaceServices> = {
  initialize: async () => createCursorWorkspaceServices(),
};

export function maybeGetCursorWorkspaceServices(): CursorWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices(CURSOR_PROVIDER_ID) as CursorWorkspaceServices | null;
}
