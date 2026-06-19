import type { ProviderRegistration } from '../../core/providers/types';
import { DroidInlineEditService } from './auxiliary/DroidInlineEditService';
import { DroidInstructionRefineService } from './auxiliary/DroidInstructionRefineService';
import { DroidTaskResultInterpreter } from './auxiliary/DroidTaskResultInterpreter';
import { DroidTitleGenerationService } from './auxiliary/DroidTitleGenerationService';
import { DROID_PROVIDER_CAPABILITIES } from './capabilities';
import { droidSettingsReconciler } from './env/DroidSettingsReconciler';
import { DroidConversationHistoryService } from './history/DroidConversationHistoryService';
import { DroidChatRuntime } from './runtime/DroidChatRuntime';
import { getDroidProviderSettings } from './settings';
import { droidChatUIConfig } from './ui/DroidChatUIConfig';

export const droidProviderRegistration: ProviderRegistration = {
  blankTabOrder: 14,
  capabilities: DROID_PROVIDER_CAPABILITIES,
  chatUIConfig: droidChatUIConfig,
  createInlineEditService: (plugin) => new DroidInlineEditService(plugin),
  createInstructionRefineService: (plugin) => new DroidInstructionRefineService(plugin),
  createRuntime: ({ plugin }) => new DroidChatRuntime(plugin),
  createTitleGenerationService: (plugin) => new DroidTitleGenerationService(plugin),
  displayName: 'Droid',
  environmentKeyPatterns: [/^DROID_/i],
  historyService: new DroidConversationHistoryService(),
  isEnabled: (settings) => getDroidProviderSettings(settings).enabled,
  settingsReconciler: droidSettingsReconciler,
  taskResultInterpreter: new DroidTaskResultInterpreter(),
};
