import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../core/providers/ProviderWorkspaceRegistry';
import { cursorWorkspaceRegistration } from './cursor/app/CursorWorkspaceServices';
import { CURSOR_PROVIDER_ID } from './cursor/models';
import { cursorProviderRegistration } from './cursor/registration';
import { grokWorkspaceRegistration } from './grok/app/GrokWorkspaceServices';
import { grokProviderRegistration } from './grok/registration';

let builtInProvidersRegistered = false;

export function registerBuiltInProviders(): void {
  if (builtInProvidersRegistered) {
    return;
  }

  ProviderRegistry.register('grok', grokProviderRegistration);
  ProviderWorkspaceRegistry.register('grok', grokWorkspaceRegistration);
  ProviderRegistry.register(CURSOR_PROVIDER_ID, cursorProviderRegistration);
  ProviderWorkspaceRegistry.register(CURSOR_PROVIDER_ID, cursorWorkspaceRegistration);
  builtInProvidersRegistered = true;
}

registerBuiltInProviders();
