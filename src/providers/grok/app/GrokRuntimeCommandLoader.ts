import type {
  ProviderRuntimeCommandLoader,
  ProviderRuntimeCommandLoaderContext,
} from '../../../core/providers/types';
import { GrokChatRuntime } from '../runtime/GrokChatRuntime';
import { getGrokProviderSettings } from '../settings';

export class GrokRuntimeCommandLoader implements ProviderRuntimeCommandLoader {
  isAvailable(settings: Record<string, unknown>): boolean {
    return getGrokProviderSettings(settings).enabled;
  }

  async loadCommands(context: ProviderRuntimeCommandLoaderContext) {
    const shouldWarmBlankSession = context.allowSessionCreation === true
      && !context.conversation?.sessionId;
    const hasPersistedSession = Boolean(context.conversation?.sessionId);

    if (!context.runtime && !hasPersistedSession && !shouldWarmBlankSession) {
      return [];
    }

    const canReuseRuntime = context.runtime?.providerId === 'grok';
    const runtime = canReuseRuntime
      ? context.runtime!
      : new GrokChatRuntime(context.plugin);

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
