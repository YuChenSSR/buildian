import { DROID_PROVIDER_CAPABILITIES } from '@/providers/droid/capabilities';

describe('DROID_PROVIDER_CAPABILITIES', () => {
  it('describes Droid as an ACP-backed coding provider', () => {
    expect(DROID_PROVIDER_CAPABILITIES).toMatchObject({
      providerId: 'droid',
      reasoningControl: 'effort',
      supportsFork: false,
      supportsImageAttachments: false,
      supportsInstructionMode: true,
      supportsMcpTools: false,
      supportsPersistentRuntime: true,
      supportsPlanMode: true,
      supportsProviderCommands: true,
      supportsRewind: false,
      supportsTurnSteer: false,
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DROID_PROVIDER_CAPABILITIES)).toBe(true);
  });
});
