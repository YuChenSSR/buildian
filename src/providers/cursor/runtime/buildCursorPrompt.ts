import type { ChatTurnRequest } from '../../../core/runtime/types';
import type { ChatMessage } from '../../../core/types';
import { appendBrowserContext } from '../../../utils/browser';
import { appendCanvasContext } from '../../../utils/canvas';
import { appendCurrentNote } from '../../../utils/context';
import { appendEditorContext } from '../../../utils/editor';
import { buildContextFromHistory, buildPromptWithHistoryContext } from '../../../utils/session';
import type { AcpContentBlock } from '../../acp';

export function buildCursorPromptText(
  request: ChatTurnRequest,
  conversationHistory: ChatMessage[] = [],
  systemPrompt = '',
): string {
  let prompt = request.text;

  if (request.currentNotePath) {
    prompt = appendCurrentNote(prompt, request.currentNotePath);
  }

  if (request.editorSelection && request.editorSelection.mode !== 'none') {
    prompt = appendEditorContext(prompt, request.editorSelection);
  }

  if (request.browserSelection) {
    prompt = appendBrowserContext(prompt, request.browserSelection);
  }

  if (request.canvasSelection) {
    prompt = appendCanvasContext(prompt, request.canvasSelection);
  }

  if (conversationHistory.length > 0) {
    const historyContext = buildContextFromHistory(conversationHistory);
    prompt = buildPromptWithHistoryContext(
      historyContext,
      prompt,
      prompt,
      conversationHistory,
    );
  }

  return prependCursorSystemInstructions(prompt, systemPrompt);
}

export function buildCursorPromptBlocks(
  request: ChatTurnRequest,
  conversationHistory: ChatMessage[] = [],
  systemPrompt = '',
): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = [
    { type: 'text', text: buildCursorPromptText(request, conversationHistory, systemPrompt) },
  ];

  for (const image of request.images ?? []) {
    if (!image.data) {
      continue;
    }

    blocks.push({
      data: image.data,
      mimeType: image.mediaType,
      type: 'image',
    });
  }

  return blocks;
}

export function prependCursorSystemInstructions(prompt: string, systemPrompt: string): string {
  const trimmedSystemPrompt = systemPrompt.trim();
  if (!trimmedSystemPrompt) {
    return prompt;
  }

  return [
    '<system_instructions priority="high">',
    'Follow these instructions for every response in this conversation. They override default style preferences when they conflict.',
    trimmedSystemPrompt,
    '</system_instructions>',
    '',
    prompt,
  ].join('\n');
}
