import type {
  ProviderRuntimeCommandLoader,
  ProviderRuntimeCommandLoaderContext,
} from '../../../core/providers/types';
import { AMP_PROVIDER_ID } from '../models';
import { AmpChatRuntime } from '../runtime/AmpChatRuntime';
import { getAmpProviderSettings } from '../settings';

export class AmpRuntimeCommandLoader implements ProviderRuntimeCommandLoader {
  isAvailable(settings: Record<string, unknown>): boolean {
    return getAmpProviderSettings(settings).enabled;
  }

  async loadCommands(context: ProviderRuntimeCommandLoaderContext) {
    const shouldWarmBlankSession = context.allowSessionCreation === true
      && !context.conversation?.sessionId;
    const hasPersistedSession = Boolean(context.conversation?.sessionId);

    if (!context.runtime && !hasPersistedSession && !shouldWarmBlankSession) {
      return [];
    }

    const canReuseRuntime = context.runtime?.providerId === AMP_PROVIDER_ID;
    const runtime = canReuseRuntime
      ? context.runtime!
      : new AmpChatRuntime(context.plugin);

    try {
      if (context.conversation) {
        runtime.syncConversationState(context.conversation, context.externalContextPaths);
      }

      const ready = await runtime.ensureReady({
        allowSessionCreation: false,
      });
      if (!ready) {
        return [];
      }

      return await runtime.getSupportedCommands();
    } finally {
      if (runtime !== context.runtime) {
        runtime.cleanup();
      }
    }
  }
}
