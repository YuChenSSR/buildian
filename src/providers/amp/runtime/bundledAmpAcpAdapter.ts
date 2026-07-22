/**
 * Dependency-free ACP bridge executed by Node in a subprocess. Keeping the
 * bridge as source inside main.js preserves Obsidian's standard three-file
 * plugin distribution while allowing Buildian to track Amp CLI changes ahead
 * of independently released third-party adapters.
 */
export const BUNDLED_AMP_ACP_ADAPTER_SOURCE = String.raw`
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const MODES = ['low', 'medium', 'high', 'ultra'];
const PERMISSIONS = ['default', 'bypass'];
const sessions = new Map();

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message, details) {
  send({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(details ? { data: { details } } : {}) },
  });
}

function notify(sessionId, update) {
  send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update } });
}

function configOptions(session) {
  return [
    {
      type: 'select',
      id: 'permission',
      name: 'Permissions',
      description: 'Choose Amp default permissions or bypass.',
      category: 'mode',
      currentValue: session.permission,
      options: [
        { value: 'default', name: 'Default' },
        { value: 'bypass', name: 'Bypass' },
      ],
    },
    {
      type: 'select',
      id: 'amp-mode',
      name: 'Amp Mode',
      description: 'Select the Amp execution mode.',
      category: 'model',
      currentValue: session.mode,
      options: MODES.map((value) => ({
        value,
        name: value.charAt(0).toUpperCase() + value.slice(1),
      })),
    },
  ];
}

function promptText(blocks) {
  let text = '';
  for (const block of blocks || []) {
    if (block.type === 'text' && String(block.text || '').trim() === '/init') {
      text += 'Analyze this codebase and create or update AGENTS.md with concise build, test, architecture, and coding-convention guidance for coding agents.';
    } else if (block.type === 'text') text += block.text || '';
    if (block.type === 'resource_link') text += '\n' + (block.uri || '') + '\n';
    if (block.type === 'resource' && block.resource && typeof block.resource.text === 'string') {
      text += '\n<context ref="' + (block.resource.uri || '') + '">\n';
      text += block.resource.text + '\n</context>\n';
    }
  }
  return text;
}

function safeValue(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function contentItems(content, isError) {
  if (typeof content === 'string') {
    return [{ type: 'content', content: { type: 'text', text: content } }];
  }
  if (!Array.isArray(content)) return [];
  return content.map((item) => ({
    type: 'content',
    content: item && item.type === 'text'
      ? { type: 'text', text: item.text || '', ...(isError ? { annotations: { audience: ['user'] } } : {}) }
      : item,
  }));
}

function emitMessage(message, sessionId) {
  const content = message && message.message && message.message.content;
  if (typeof content === 'string') {
    notify(sessionId, {
      sessionUpdate: message.type === 'assistant' ? 'agent_message_chunk' : 'user_message_chunk',
      content: { type: 'text', text: content },
    });
    return;
  }
  if (!Array.isArray(content)) return;
  for (const chunk of content) {
    if (!chunk || typeof chunk !== 'object') continue;
    if (chunk.type === 'text') {
      notify(sessionId, {
        sessionUpdate: message.type === 'assistant' ? 'agent_message_chunk' : 'user_message_chunk',
        content: { type: 'text', text: chunk.text || '' },
      });
    } else if (chunk.type === 'thinking') {
      notify(sessionId, {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: chunk.thinking || '' },
      });
    } else if (chunk.type === 'tool_use') {
      notify(sessionId, {
        sessionUpdate: 'tool_call',
        toolCallId: chunk.id,
        rawInput: safeValue(chunk.input),
        status: 'pending',
        title: chunk.name || 'Tool',
        kind: 'other',
        content: [],
      });
    } else if (chunk.type === 'tool_result') {
      notify(sessionId, {
        sessionUpdate: 'tool_call_update',
        toolCallId: chunk.tool_use_id,
        status: chunk.is_error ? 'failed' : 'completed',
        content: contentItems(chunk.content, Boolean(chunk.is_error)),
      });
    }
  }
}

async function runPrompt(params) {
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error('Session not found');
  const args = [];
  if (session.threadId) args.push('threads', 'continue', session.threadId);
  args.push('--execute', '--stream-json-thinking', '--mode', session.mode);
  if (session.permission === 'bypass') args.push('--dangerously-allow-all');

  const command = process.env.AMP_CLI_PATH || 'amp';
  const child = spawn(command, args, {
    cwd: session.cwd,
    env: { ...process.env, TERM: 'dumb' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  session.process = child;
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const output = createInterface({ input: child.stdout });
  output.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      if (!session.threadId && message.session_id) session.threadId = message.session_id;
      if (message.type === 'assistant' || message.type === 'user') emitMessage(message, params.sessionId);
      if (message.type === 'result' && message.is_error) {
        notify(params.sessionId, {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Error: ' + (message.error || 'Amp request failed') },
        });
      }
    } catch (error) {
      stderr += '\nFailed to parse Amp output: ' + String(error);
    }
  });
  child.stdin.end(promptText(params.prompt));

  const outcome = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  session.process = null;
  if (session.cancelled) {
    session.cancelled = false;
    return { stopReason: 'cancelled' };
  }
  if (outcome.code !== 0 || outcome.signal) {
    throw new Error(stderr.trim() || 'Amp exited with code ' + String(outcome.code));
  }
  return { stopReason: 'end_turn' };
}

async function handle(message) {
  const method = message.method;
  const params = message.params || {};
  if (method === 'initialize') {
    respond(message.id, {
      protocolVersion: 1,
      agentInfo: { name: 'buildian-amp-acp', title: 'Buildian Amp ACP', version: '1' },
      agentCapabilities: {
        promptCapabilities: { image: true, embeddedContext: true },
        mcpCapabilities: { http: false, sse: false },
      },
      authMethods: [],
    });
    return;
  }
  if (method === 'session/new' || method === 'newSession') {
    const sessionId = 'S-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const session = {
      cwd: params.cwd || process.cwd(),
      mode: 'medium',
      permission: 'default',
      threadId: null,
      process: null,
      cancelled: false,
    };
    sessions.set(sessionId, session);
    respond(message.id, { sessionId, configOptions: configOptions(session) });
    queueMicrotask(() => notify(sessionId, {
      sessionUpdate: 'available_commands_update',
      availableCommands: [{ name: 'init', description: 'Generate an AGENTS.md file for the project' }],
    }));
    return;
  }
  if (method === 'session/set_config_option' || method === 'setSessionConfigOption') {
    const session = sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');
    if (params.configId === 'amp-mode' && MODES.includes(params.value)) session.mode = params.value;
    else if (params.configId === 'permission' && PERMISSIONS.includes(params.value)) session.permission = params.value;
    else throw new Error('Unsupported config option value');
    const options = configOptions(session);
    respond(message.id, { configOptions: options });
    notify(params.sessionId, { sessionUpdate: 'config_option_update', configOptions: options });
    return;
  }
  if (method === 'session/set_mode' || method === 'setSessionMode') {
    const session = sessions.get(params.sessionId);
    if (!session || !PERMISSIONS.includes(params.modeId)) throw new Error('Unsupported permission mode');
    session.permission = params.modeId;
    respond(message.id, {});
    return;
  }
  if (method === 'session/prompt' || method === 'prompt') {
    respond(message.id, await runPrompt(params));
    return;
  }
  if (method === 'session/cancel' || method === 'cancel') {
    const session = sessions.get(params.sessionId);
    if (session && session.process) {
      session.cancelled = true;
      session.process.kill('SIGTERM');
    }
    if (message.id !== undefined) respond(message.id, {});
    return;
  }
  if (method === 'authenticate') {
    respond(message.id, {});
    return;
  }
  fail(message.id, -32601, 'Method not found');
}

const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const message = JSON.parse(line);
    Promise.resolve(handle(message)).catch((error) => {
      if (message.id !== undefined) fail(message.id, -32603, 'Internal error', String(error));
    });
  } catch (error) {
    fail(null, -32700, 'Parse error', String(error));
  }
});
`.trimStart();
