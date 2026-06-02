import { GrokCommandCatalog } from '@/providers/grok/commands/GrokCommandCatalog';

describe('GrokCommandCatalog', () => {
  it('maps runtime commands into slash dropdown entries', async () => {
    const catalog = new GrokCommandCatalog();
    catalog.setRuntimeCommands([
      {
        id: 'grok:/compact',
        name: '/compact',
        description: 'Compact context',
        argumentHint: '$1',
        content: '',
        source: 'sdk',
      },
      {
        id: 'grok:compact-duplicate',
        name: 'compact',
        description: 'Duplicate entry',
        content: '',
        source: 'sdk',
      },
      {
        id: 'grok:context',
        name: 'context',
        description: 'Show context',
        content: '',
        source: 'sdk',
      },
    ]);

    await expect(catalog.listDropdownEntries({ includeBuiltIns: false })).resolves.toEqual([
      {
        id: 'grok:/compact',
        providerId: 'grok',
        kind: 'command',
        name: 'compact',
        description: 'Compact context',
        content: '',
        argumentHint: '$1',
        scope: 'runtime',
        source: 'sdk',
        isEditable: false,
        isDeletable: false,
        displayPrefix: '/',
        insertPrefix: '/',
      },
      {
        id: 'grok:context',
        providerId: 'grok',
        kind: 'command',
        name: 'context',
        description: 'Show context',
        content: '',
        scope: 'runtime',
        source: 'sdk',
        isEditable: false,
        isDeletable: false,
        displayPrefix: '/',
        insertPrefix: '/',
      },
    ]);
  });

  it('uses slash triggers for the shared dropdown', () => {
    const catalog = new GrokCommandCatalog();

    expect(catalog.getDropdownConfig()).toEqual({
      providerId: 'grok',
      triggerChars: ['/'],
      builtInPrefix: '/',
      skillPrefix: '/',
      commandPrefix: '/',
    });
  });
});
