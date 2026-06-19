import type {
  ProviderRuntimeCommandLoader,
  ProviderRuntimeCommandLoaderContext,
} from '../../../core/providers/types';
import { DROID_PROVIDER_ID } from '../models';
import { DroidChatRuntime } from '../runtime/DroidChatRuntime';
import { getDroidProviderSettings } from '../settings';

export class DroidRuntimeCommandLoader implements ProviderRuntimeCommandLoader {
  isAvailable(settings: Record<string, unknown>): boolean {
    return getDroidProviderSettings(settings).enabled;
  }

  async loadCommands(context: ProviderRuntimeCommandLoaderContext) {
    const shouldWarmBlankSession = context.allowSessionCreation === true
      && !context.conversation?.sessionId;
    const hasPersistedSession = Boolean(context.conversation?.sessionId);

    if (!context.runtime && !hasPersistedSession && !shouldWarmBlankSession) {
      return [];
    }

    const canReuseRuntime = context.runtime?.providerId === DROID_PROVIDER_ID;
    const runtime = canReuseRuntime
      ? context.runtime!
      : new DroidChatRuntime(context.plugin);

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
