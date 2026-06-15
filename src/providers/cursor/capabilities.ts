import type { ProviderCapabilities } from '../../core/providers/types';
import { CURSOR_PROVIDER_ID } from './models';

export const CURSOR_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: CURSOR_PROVIDER_ID,
  supportsPersistentRuntime: true,
  supportsNativeHistory: true,
  supportsPlanMode: true,
  supportsRewind: false,
  supportsFork: false,
  supportsProviderCommands: true,
  supportsImageAttachments: true,
  supportsInstructionMode: true,
  supportsMcpTools: false,
  supportsTurnSteer: false,
  reasoningControl: 'effort',
});
