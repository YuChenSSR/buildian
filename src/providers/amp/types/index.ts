export interface AmpProviderState {
  agentVersion?: string;
  sessionConfigKey?: string;
}

export function getAmpState(
  providerState?: Record<string, unknown>,
): AmpProviderState {
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
