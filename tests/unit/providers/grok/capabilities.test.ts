import { GROK_PROVIDER_CAPABILITIES } from '@/providers/grok/capabilities';

describe('GROK_PROVIDER_CAPABILITIES', () => {
  it('describes Grok as an ACP-backed coding provider', () => {
    expect(GROK_PROVIDER_CAPABILITIES).toMatchObject({
      providerId: 'grok',
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
    expect(Object.isFrozen(GROK_PROVIDER_CAPABILITIES)).toBe(true);
  });
});
