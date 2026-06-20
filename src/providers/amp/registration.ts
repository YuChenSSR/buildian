import type { ProviderRegistration } from '../../core/providers/types';
import { AmpInlineEditService } from './auxiliary/AmpInlineEditService';
import { AmpInstructionRefineService } from './auxiliary/AmpInstructionRefineService';
import { AmpTaskResultInterpreter } from './auxiliary/AmpTaskResultInterpreter';
import { AmpTitleGenerationService } from './auxiliary/AmpTitleGenerationService';
import { AMP_PROVIDER_CAPABILITIES } from './capabilities';
import { ampSettingsReconciler } from './env/AmpSettingsReconciler';
import { AmpConversationHistoryService } from './history/AmpConversationHistoryService';
import { AmpChatRuntime } from './runtime/AmpChatRuntime';
import { getAmpProviderSettings } from './settings';
import { ampChatUIConfig } from './ui/AmpChatUIConfig';

export const ampProviderRegistration: ProviderRegistration = {
  blankTabOrder: 15,
  capabilities: AMP_PROVIDER_CAPABILITIES,
  chatUIConfig: ampChatUIConfig,
  createInlineEditService: (plugin) => new AmpInlineEditService(plugin),
  createInstructionRefineService: (plugin) => new AmpInstructionRefineService(plugin),
  createRuntime: ({ plugin }) => new AmpChatRuntime(plugin),
  createTitleGenerationService: (plugin) => new AmpTitleGenerationService(plugin),
  displayName: 'Amp',
  environmentKeyPatterns: [/^ACP_AMP_/i, /^AMP_/i],
  historyService: new AmpConversationHistoryService(),
  isEnabled: (settings) => getAmpProviderSettings(settings).enabled,
  settingsReconciler: ampSettingsReconciler,
  taskResultInterpreter: new AmpTaskResultInterpreter(),
};
