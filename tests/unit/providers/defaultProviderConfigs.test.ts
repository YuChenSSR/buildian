import { getBuiltInProviderDefaultConfigs } from '@/providers/defaultProviderConfigs';

describe('getBuiltInProviderDefaultConfigs', () => {
  it('returns fresh built-in provider config objects', () => {
    const first = getBuiltInProviderDefaultConfigs();
    const second = getBuiltInProviderDefaultConfigs();

    expect(Object.keys(first)).toEqual(['cursor-agent', 'droid', 'grok']);
    expect(first['cursor-agent']).toMatchObject({ enabled: false });
    expect(first.droid).toMatchObject({ enabled: false });
    expect(first.grok).toMatchObject({ enabled: true });
    expect(first).not.toBe(second);
    expect(first['cursor-agent']).not.toBe(second['cursor-agent']);
    expect(first.droid).not.toBe(second.droid);
    expect(first.grok).not.toBe(second.grok);
  });
});
