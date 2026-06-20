import type { ProviderCapabilities } from '../../core/providers/types';
import { AMP_PROVIDER_ID } from './models';

export const AMP_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: AMP_PROVIDER_ID,
  supportsPersistentRuntime: true,
  supportsNativeHistory: false,
  supportsPlanMode: false,
  supportsRewind: false,
  supportsFork: false,
  supportsProviderCommands: true,
  supportsImageAttachments: false,
  supportsInstructionMode: true,
  supportsMcpTools: false,
  supportsTurnSteer: false,
  reasoningControl: 'effort',
});
