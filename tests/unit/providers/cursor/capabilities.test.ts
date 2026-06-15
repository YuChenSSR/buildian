import { CURSOR_PROVIDER_CAPABILITIES } from '@/providers/cursor/capabilities';

describe('CURSOR_PROVIDER_CAPABILITIES', () => {
  it('describes Cursor Agent as an ACP-backed coding provider', () => {
    expect(CURSOR_PROVIDER_CAPABILITIES).toMatchObject({
      providerId: 'cursor-agent',
      reasoningControl: 'effort',
      supportsFork: false,
      supportsImageAttachments: true,
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
    expect(Object.isFrozen(CURSOR_PROVIDER_CAPABILITIES)).toBe(true);
  });
});
