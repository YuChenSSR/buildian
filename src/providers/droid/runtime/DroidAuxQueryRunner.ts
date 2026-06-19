import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as path from 'node:path';

import type { AuxQueryConfig, AuxQueryRunner } from '../../../core/auxiliary/AuxQueryRunner';
import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import {
  decodeDroidModelId,
  DROID_DEFAULT_REASONING_LEVEL,
  DROID_PROVIDER_ID,
  normalizeDroidReasoningLevel,
  resolveDroidCliModelId,
} from '../models';
import { droidChatUIConfig } from '../ui/DroidChatUIConfig';
import { prependDroidSystemInstructions } from './buildDroidPrompt';

export class DroidAuxQueryRunner implements AuxQueryRunner {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly plugin: ClaudianPlugin) {}

  query(config: AuxQueryConfig, prompt: string): Promise<string> {
    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const command = this.plugin.getResolvedProviderCliPath(DROID_PROVIDER_ID) ?? 'droid';
    const envText = getRuntimeEnvironmentText(
      this.plugin.settings,
      DROID_PROVIDER_ID,
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
      'exec',
      '--output-format',
      'text',
    ];
    const rawModel = this.resolveSelectedRawModel(config.model);
    if (rawModel) {
      args.push('-m', rawModel);
    }
    const effort = normalizeDroidReasoningLevel(this.plugin.settings.effortLevel);
    if (effort !== DROID_DEFAULT_REASONING_LEVEL) {
      args.push('-r', effort);
    }
    args.push(prependDroidSystemInstructions(prompt, config.systemPrompt).trim());
    return args;
  }

  private resolveSelectedRawModel(explicitModel?: string): string | undefined {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (explicitModel) {
      const trimmed = explicitModel.trim();
      if (!trimmed) {
        return undefined;
      }
      const rawModelId = droidChatUIConfig.ownsModel(trimmed, settings)
        ? decodeDroidModelId(trimmed) ?? undefined
        : trimmed;
      return rawModelId ? resolveDroidCliModelId(rawModelId) ?? undefined : undefined;
    }

    const selectedModel = typeof settings.model === 'string' ? settings.model : '';
    const rawModelId = droidChatUIConfig.ownsModel(selectedModel, settings)
      ? decodeDroidModelId(selectedModel) ?? undefined
      : undefined;
    return rawModelId ? resolveDroidCliModelId(rawModelId) ?? undefined : undefined;
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
    ? `Droid auxiliary request failed (${exitText}).\n\n${trimmedStderr}`
    : `Droid auxiliary request failed (${exitText}).`;
}
