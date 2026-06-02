import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../core/providers/ProviderWorkspaceRegistry';
import { grokWorkspaceRegistration } from './grok/app/GrokWorkspaceServices';
import { grokProviderRegistration } from './grok/registration';

let builtInProvidersRegistered = false;

export function registerBuiltInProviders(): void {
  if (builtInProvidersRegistered) {
    return;
  }

  ProviderRegistry.register('grok', grokProviderRegistration);
  ProviderWorkspaceRegistry.register('grok', grokWorkspaceRegistration);
  builtInProvidersRegistered = true;
}

registerBuiltInProviders();
