import { getBuiltInProviderDefaultConfigs } from '@/providers/defaultProviderConfigs';

describe('getBuiltInProviderDefaultConfigs', () => {
  it('returns fresh built-in provider config objects', () => {
    const first = getBuiltInProviderDefaultConfigs();
    const second = getBuiltInProviderDefaultConfigs();

    expect(Object.keys(first)).toEqual(['amp', 'cursor-agent', 'droid', 'grok']);
    expect(first.amp).toMatchObject({ enabled: false });
    expect(first['cursor-agent']).toMatchObject({ enabled: false });
    expect(first.droid).toMatchObject({ enabled: false });
    expect(first.grok).toMatchObject({ enabled: true });
    expect(first).not.toBe(second);
    expect(first.amp).not.toBe(second.amp);
    expect(first['cursor-agent']).not.toBe(second['cursor-agent']);
    expect(first.droid).not.toBe(second.droid);
    expect(first.grok).not.toBe(second.grok);
  });
});
