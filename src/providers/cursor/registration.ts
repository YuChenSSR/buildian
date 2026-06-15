import type { ProviderRegistration } from '../../core/providers/types';
import { CursorInlineEditService } from './auxiliary/CursorInlineEditService';
import { CursorInstructionRefineService } from './auxiliary/CursorInstructionRefineService';
import { CursorTaskResultInterpreter } from './auxiliary/CursorTaskResultInterpreter';
import { CursorTitleGenerationService } from './auxiliary/CursorTitleGenerationService';
import { CURSOR_PROVIDER_CAPABILITIES } from './capabilities';
import { cursorSettingsReconciler } from './env/CursorSettingsReconciler';
import { CursorConversationHistoryService } from './history/CursorConversationHistoryService';
import { CursorChatRuntime } from './runtime/CursorChatRuntime';
import { getCursorProviderSettings } from './settings';
import { cursorChatUIConfig } from './ui/CursorChatUIConfig';

export const cursorProviderRegistration: ProviderRegistration = {
  blankTabOrder: 13,
  capabilities: CURSOR_PROVIDER_CAPABILITIES,
  chatUIConfig: cursorChatUIConfig,
  createInlineEditService: (plugin) => new CursorInlineEditService(plugin),
  createInstructionRefineService: (plugin) => new CursorInstructionRefineService(plugin),
  createRuntime: ({ plugin }) => new CursorChatRuntime(plugin),
  createTitleGenerationService: (plugin) => new CursorTitleGenerationService(plugin),
  displayName: 'Cursor Agent',
  environmentKeyPatterns: [/^CURSOR_/i],
  historyService: new CursorConversationHistoryService(),
  isEnabled: (settings) => getCursorProviderSettings(settings).enabled,
  settingsReconciler: cursorSettingsReconciler,
  taskResultInterpreter: new CursorTaskResultInterpreter(),
};
