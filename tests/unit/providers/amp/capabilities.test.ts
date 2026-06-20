import { AMP_PROVIDER_CAPABILITIES } from '@/providers/amp/capabilities';

describe('AMP_PROVIDER_CAPABILITIES', () => {
  it('describes Amp as an ACP-backed provider', () => {
    expect(AMP_PROVIDER_CAPABILITIES).toMatchObject({
      providerId: 'amp',
      reasoningControl: 'effort',
      supportsFork: false,
      supportsImageAttachments: false,
      supportsInstructionMode: true,
      supportsMcpTools: false,
      supportsNativeHistory: false,
      supportsPersistentRuntime: true,
      supportsPlanMode: false,
      supportsProviderCommands: true,
      supportsRewind: false,
      supportsTurnSteer: false,
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(AMP_PROVIDER_CAPABILITIES)).toBe(true);
  });
});
