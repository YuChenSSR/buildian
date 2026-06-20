import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as path from 'node:path';

import type { AuxQueryConfig, AuxQueryRunner } from '../../../core/auxiliary/AuxQueryRunner';
import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type ClaudianPlugin from '../../../main';
import { findCliBinaryPath } from '../../../utils/cliBinaryLocator';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { AMP_PROVIDER_ID } from '../models';
import { prependAmpSystemInstructions } from './buildAmpPrompt';

export class AmpAuxQueryRunner implements AuxQueryRunner {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly plugin: ClaudianPlugin) {}

  query(config: AuxQueryConfig, prompt: string): Promise<string> {
    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const envText = getRuntimeEnvironmentText(
      this.plugin.settings,
      AMP_PROVIDER_ID,
    );
    const customEnv = parseEnvironmentVariables(envText);
    const command = findCliBinaryPath('amp', customEnv.PATH) ?? 'amp';
    const env = {
      ...process.env,
      ...customEnv,
      PATH: getEnhancedPath(customEnv.PATH, path.isAbsolute(command) ? command : undefined),
    };
    const args = [
      '-x',
      prependAmpSystemInstructions(prompt, config.systemPrompt).trim(),
    ];

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
}

function formatExitError(code: number | null, signal: string | null, stderr: string): string {
  const exitText = signal
    ? `signal ${signal}`
    : code === null
      ? 'unknown exit'
      : `code ${code}`;
  const trimmedStderr = stderr.trim();
  return trimmedStderr
    ? `Amp auxiliary request failed (${exitText}).\n\n${trimmedStderr}`
    : `Amp auxiliary request failed (${exitText}).`;
}
