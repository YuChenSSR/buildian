import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../core/providers/ProviderWorkspaceRegistry';
import { ampWorkspaceRegistration } from './amp/app/AmpWorkspaceServices';
import { AMP_PROVIDER_ID } from './amp/models';
import { ampProviderRegistration } from './amp/registration';
import { cursorWorkspaceRegistration } from './cursor/app/CursorWorkspaceServices';
import { CURSOR_PROVIDER_ID } from './cursor/models';
import { cursorProviderRegistration } from './cursor/registration';
import { droidWorkspaceRegistration } from './droid/app/DroidWorkspaceServices';
import { DROID_PROVIDER_ID } from './droid/models';
import { droidProviderRegistration } from './droid/registration';
import { grokWorkspaceRegistration } from './grok/app/GrokWorkspaceServices';
import { grokProviderRegistration } from './grok/registration';

let builtInProvidersRegistered = false;

export function registerBuiltInProviders(): void {
  if (builtInProvidersRegistered) {
    return;
  }

  ProviderRegistry.register('grok', grokProviderRegistration);
  ProviderWorkspaceRegistry.register('grok', grokWorkspaceRegistration);
  ProviderRegistry.register(AMP_PROVIDER_ID, ampProviderRegistration);
  ProviderWorkspaceRegistry.register(AMP_PROVIDER_ID, ampWorkspaceRegistration);
  ProviderRegistry.register(CURSOR_PROVIDER_ID, cursorProviderRegistration);
  ProviderWorkspaceRegistry.register(CURSOR_PROVIDER_ID, cursorWorkspaceRegistration);
  ProviderRegistry.register(DROID_PROVIDER_ID, droidProviderRegistration);
  ProviderWorkspaceRegistry.register(DROID_PROVIDER_ID, droidWorkspaceRegistration);
  builtInProvidersRegistered = true;
}

registerBuiltInProviders();
