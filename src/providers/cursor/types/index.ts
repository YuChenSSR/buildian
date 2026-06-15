export interface CursorProviderState {
  agentVersion?: string;
  sessionConfigKey?: string;
}

export function getCursorState(
  providerState?: Record<string, unknown>,
): CursorProviderState {
  if (!providerState || typeof providerState !== 'object' || Array.isArray(providerState)) {
    return {};
  }

  return {
    ...(typeof providerState.agentVersion === 'string'
      ? { agentVersion: providerState.agentVersion }
      : {}),
    ...(typeof providerState.sessionConfigKey === 'string'
      ? { sessionConfigKey: providerState.sessionConfigKey }
      : {}),
  };
}
