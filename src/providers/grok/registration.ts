import type { ProviderRegistration } from '../../core/providers/types';
import { GrokInlineEditService } from './auxiliary/GrokInlineEditService';
import { GrokInstructionRefineService } from './auxiliary/GrokInstructionRefineService';
import { GrokTaskResultInterpreter } from './auxiliary/GrokTaskResultInterpreter';
import { GrokTitleGenerationService } from './auxiliary/GrokTitleGenerationService';
import { GROK_PROVIDER_CAPABILITIES } from './capabilities';
import { grokSettingsReconciler } from './env/GrokSettingsReconciler';
import { GrokConversationHistoryService } from './history/GrokConversationHistoryService';
import { GrokChatRuntime } from './runtime/GrokChatRuntime';
import { getGrokProviderSettings } from './settings';
import { grokChatUIConfig } from './ui/GrokChatUIConfig';

export const grokProviderRegistration: ProviderRegistration = {
  blankTabOrder: 12,
  capabilities: GROK_PROVIDER_CAPABILITIES,
  chatUIConfig: grokChatUIConfig,
  createInlineEditService: (plugin) => new GrokInlineEditService(plugin),
  createInstructionRefineService: (plugin) => new GrokInstructionRefineService(plugin),
  createRuntime: ({ plugin }) => new GrokChatRuntime(plugin),
  createTitleGenerationService: (plugin) => new GrokTitleGenerationService(plugin),
  displayName: 'Grok Build',
  environmentKeyPatterns: [/^GROK_/i, /^XAI_/i],
  historyService: new GrokConversationHistoryService(),
  isEnabled: (settings) => getGrokProviderSettings(settings).enabled,
  settingsReconciler: grokSettingsReconciler,
  taskResultInterpreter: new GrokTaskResultInterpreter(),
};
