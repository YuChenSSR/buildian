export interface DroidProviderState {
  agentVersion?: string;
  sessionConfigKey?: string;
}

export function getDroidState(
  providerState?: Record<string, unknown>,
): DroidProviderState {
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
