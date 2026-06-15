import '@/providers';

import { getEnabledProviderForModel, getProviderForModel } from '@/core/providers/modelRouting';
import { encodeCursorModelId } from '@/providers/cursor/models';
import { encodeGrokModelId, GROK_DEFAULT_MODEL_ID } from '@/providers/grok/models';

describe('getProviderForModel', () => {
  it('routes Grok model selections to grok', () => {
    expect(getProviderForModel('grok')).toBe('grok');
    expect(getProviderForModel(encodeGrokModelId(GROK_DEFAULT_MODEL_ID))).toBe('grok');
    expect(getProviderForModel('grok:grok-composer-2.5-fast')).toBe('grok');
  });

  it('routes Cursor Agent model selections to cursor-agent', () => {
    expect(getProviderForModel('cursor-agent')).toBe('cursor-agent');
    expect(getProviderForModel(encodeCursorModelId('default[]'))).toBe('cursor-agent');
    expect(getProviderForModel('cursor-agent:claude-sonnet-4-5[context=200k]')).toBe('cursor-agent');
  });

  it('routes unknown models to grok as the default built-in provider', () => {
    expect(getProviderForModel('some-unknown-model')).toBe('grok');
    expect(getProviderForModel('claude-sonnet-4-5-20250514')).toBe('grok');
    expect(getProviderForModel('gpt-4o')).toBe('grok');
  });

  it('resolves within enabled providers to grok', () => {
    const settings = {
      providerConfigs: {
        grok: {
          enabled: true,
        },
      },
    };

    expect(getEnabledProviderForModel(encodeGrokModelId(GROK_DEFAULT_MODEL_ID), settings)).toBe('grok');
    expect(getEnabledProviderForModel('some-unknown-model', settings)).toBe('grok');
  });

  it('resolves within enabled providers to cursor-agent', () => {
    const settings = {
      settingsProvider: 'cursor-agent',
      providerConfigs: {
        'cursor-agent': {
          enabled: true,
        },
      },
    };

    expect(getEnabledProviderForModel(encodeCursorModelId('default[]'), settings)).toBe('cursor-agent');
    expect(getEnabledProviderForModel('some-unknown-model', settings)).toBe('cursor-agent');
  });

  it('falls back to grok when saved settings reference a legacy provider', () => {
    const settings = {
      settingsProvider: 'claude',
      providerConfigs: {
        grok: {
          enabled: true,
        },
      },
    };

    expect(getEnabledProviderForModel('claude-sonnet-4-5-20250514', settings)).toBe('grok');
  });
});
