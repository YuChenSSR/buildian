import { spawn } from 'node:child_process';

import { buildAmpAcpAdapterArgs } from '@/providers/amp/runtime/AmpCliResolver';

describe('buildAmpAcpAdapterArgs', () => {
  it('runs installed adapters without extra arguments', () => {
    expect(buildAmpAcpAdapterArgs('/Users/me/.local/bin/amp-acp')).toEqual([]);
  });

  it('runs the bundled bridge through Node', () => {
    const args = buildAmpAcpAdapterArgs('/opt/homebrew/bin/node');

    expect(args.slice(0, 2)).toEqual(['--input-type=module', '--eval']);
    expect(args[2]).toContain("const MODES = ['low', 'medium', 'high', 'ultra']");
  });

  it('negotiates all current modes with the bundled bridge', async () => {
    const child = spawn(process.execPath, buildAmpAcpAdapterArgs(process.execPath), {
      stdio: 'pipe',
    });

    const result = await new Promise<{ currentValue: string; values: string[] }>((resolve, reject) => {
      let buffer = '';
      const timeout = setTimeout(() => reject(new Error('Bundled Amp ACP bridge timed out')), 5_000);
      const finish = (callback: () => void) => {
        clearTimeout(timeout);
        child.kill('SIGTERM');
        callback();
      };

      child.once('error', error => finish(() => reject(error)));
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');
          if (!line.trim()) continue;

          const message = JSON.parse(line);
          if (message.id === 1) {
            child.stdin.write(`${JSON.stringify({
              id: 2,
              jsonrpc: '2.0',
              method: 'session/new',
              params: { cwd: process.cwd(), mcpServers: [] },
            })}\n`);
          } else if (message.id === 2) {
            child.stdin.write(`${JSON.stringify({
              id: 3,
              jsonrpc: '2.0',
              method: 'session/set_config_option',
              params: {
                configId: 'amp-mode',
                sessionId: message.result.sessionId,
                type: 'select',
                value: 'ultra',
              },
            })}\n`);
          } else if (message.id === 3) {
            const mode = message.result.configOptions.find((option: { id: string }) => (
              option.id === 'amp-mode'
            ));
            finish(() => resolve({
              currentValue: mode.currentValue,
              values: mode.options.map((option: { value: string }) => option.value),
            }));
          }
        }
      });

      child.stdin.write(`${JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          clientCapabilities: {},
          clientInfo: { name: 'buildian-test', version: '0.0.0' },
          protocolVersion: 1,
        },
      })}\n`);
    });

    expect(result).toEqual({
      currentValue: 'ultra',
      values: ['low', 'medium', 'high', 'ultra'],
    });
  });
});
