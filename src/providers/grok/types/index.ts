export interface GrokProviderState {
  agentVersion?: string;
}

export function getGrokState(
  providerState?: Record<string, unknown>,
): GrokProviderState {
  return providerState ?? {};
}
