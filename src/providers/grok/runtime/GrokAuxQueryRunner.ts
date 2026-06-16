import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as path from 'node:path';

import type { AuxQueryConfig, AuxQueryRunner } from '../../../core/auxiliary/AuxQueryRunner';
import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { decodeGrokModelId } from '../models';
import { grokChatUIConfig } from '../ui/GrokChatUIConfig';

export class GrokAuxQueryRunner implements AuxQueryRunner {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly plugin: ClaudianPlugin) {}

  query(config: AuxQueryConfig, prompt: string): Promise<string> {
    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const command = this.plugin.getResolvedProviderCliPath('grok') ?? 'grok';
    const envText = getRuntimeEnvironmentText(
      this.plugin.settings,
      'grok',
    );
    const customEnv = parseEnvironmentVariables(envText);
    const env = {
      ...process.env,
      ...customEnv,
      PATH: getEnhancedPath(customEnv.PATH, path.isAbsolute(command) ? command : undefined),
    };
    const args = this.buildArgs(config, prompt);

    return new Promise<string>((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd,
        env,
        stdio: 'pipe',
        windowsHide: true,
      });
      this.activeProcess = proc;

      let stdout = '';
      let stderr = '';
      const abortHandler = () => {
        proc.kill('SIGTERM');
        reject(new Error('Cancelled'));
      };

      config.abortController?.signal.addEventListener('abort', abortHandler, { once: true });

      proc.stdout.on('data', (chunk: Buffer | string) => {
        stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        config.onTextChunk?.(stdout);
      });
      proc.stderr.on('data', (chunk: Buffer | string) => {
        stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      });
      proc.on('error', (error) => {
        cleanup();
        reject(error);
      });
      proc.on('exit', (code, signal) => {
        cleanup();
        if (config.abortController?.signal.aborted) {
          reject(new Error('Cancelled'));
          return;
        }
        if (code === 0 && signal === null) {
          resolve(stdout);
          return;
        }
        reject(new Error(formatExitError(code, signal, stderr)));
      });

      if (config.abortController?.signal.aborted) {
        abortHandler();
      }

      const cleanup = () => {
        config.abortController?.signal.removeEventListener('abort', abortHandler);
        if (this.activeProcess === proc) {
          this.activeProcess = null;
        }
      };
    });
  }

  reset(): void {
    this.activeProcess?.kill('SIGTERM');
    this.activeProcess = null;
  }

  private buildArgs(config: AuxQueryConfig, prompt: string): string[] {
    const args = [
      '--no-auto-update',
      '--no-memory',
      '--permission-mode',
      'default',
      '--output-format',
      'plain',
      '--system-prompt-override',
      config.systemPrompt,
      '--verbatim',
    ];
    const rawModel = this.resolveSelectedRawModel(config.model);
    if (rawModel) {
      args.push('--model', rawModel);
    }
    args.push('--single', prompt);
    return args;
  }

  private resolveSelectedRawModel(explicitModel?: string): string | undefined {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (explicitModel) {
      const trimmed = explicitModel.trim();
      if (!trimmed) {
        return undefined;
      }
      return grokChatUIConfig.ownsModel(trimmed, settings)
        ? decodeGrokModelId(trimmed) ?? undefined
        : trimmed;
    }

    const selectedModel = typeof settings.model === 'string' ? settings.model : '';
    return grokChatUIConfig.ownsModel(selectedModel, settings)
      ? decodeGrokModelId(selectedModel) ?? undefined
      : undefined;
  }
}

function formatExitError(code: number | null, signal: string | null, stderr: string): string {
  const exitText = signal
    ? `signal ${signal}`
    : code === null
      ? 'unknown exit'
      : `code ${code}`;
  const trimmedStderr = stderr.trim();
  return trimmedStderr
    ? `Grok auxiliary request failed (${exitText}).\n\n${trimmedStderr}`
    : `Grok auxiliary request failed (${exitText}).`;
}
