import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as path from 'node:path';

import type { AuxQueryConfig, AuxQueryRunner } from '../../../core/auxiliary/AuxQueryRunner';
import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import {
  CURSOR_PROVIDER_ID,
  decodeCursorModelId,
  normalizeCursorReasoningLevel,
  resolveCursorCliModelId,
} from '../models';
import { cursorChatUIConfig } from '../ui/CursorChatUIConfig';
import { prependCursorSystemInstructions } from './buildCursorPrompt';

export class CursorAuxQueryRunner implements AuxQueryRunner {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly plugin: ClaudianPlugin) {}

  query(config: AuxQueryConfig, prompt: string): Promise<string> {
    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const command = this.plugin.getResolvedProviderCliPath(CURSOR_PROVIDER_ID) ?? 'cursor-agent';
    const envText = getRuntimeEnvironmentText(
      this.plugin.settings,
      CURSOR_PROVIDER_ID,
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
      '--print',
      '--output-format',
      'text',
      '--mode',
      'ask',
      '--trust',
    ];
    const rawModel = this.resolveSelectedRawModel(config.model);
    if (rawModel) {
      args.push('--model', rawModel);
    }
    args.push(prependCursorSystemInstructions(prompt, config.systemPrompt).trim());
    return args;
  }

  private resolveSelectedRawModel(explicitModel?: string): string | undefined {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (explicitModel) {
      const trimmed = explicitModel.trim();
      if (!trimmed) {
        return undefined;
      }
      const rawModelId = cursorChatUIConfig.ownsModel(trimmed, settings)
        ? decodeCursorModelId(trimmed) ?? undefined
        : trimmed;
      return rawModelId
        ? resolveCursorCliModelId(rawModelId, settings.effortLevel) ?? undefined
        : undefined;
    }

    const selectedModel = typeof settings.model === 'string' ? settings.model : '';
    const rawModelId = cursorChatUIConfig.ownsModel(selectedModel, settings)
      ? decodeCursorModelId(selectedModel) ?? undefined
      : undefined;
    return rawModelId
      ? resolveCursorCliModelId(rawModelId, normalizeCursorReasoningLevel(settings.effortLevel)) ?? undefined
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
    ? `Cursor auxiliary request failed (${exitText}).\n\n${trimmedStderr}`
    : `Cursor auxiliary request failed (${exitText}).`;
}
