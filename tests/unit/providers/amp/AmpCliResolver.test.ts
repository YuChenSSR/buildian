import { buildAmpAcpAdapterArgs } from '@/providers/amp/runtime/AmpCliResolver';

describe('buildAmpAcpAdapterArgs', () => {
  it('runs global acp-amp without extra arguments', () => {
    expect(buildAmpAcpAdapterArgs('/Users/me/.local/bin/acp-amp')).toEqual([]);
  });

  it('runs the npm adapter package when launched through npx', () => {
    expect(buildAmpAcpAdapterArgs('/opt/homebrew/bin/npx')).toEqual([
      '@superagenticai/acp-amp',
    ]);
    expect(buildAmpAcpAdapterArgs('npx.cmd')).toEqual([
      '@superagenticai/acp-amp',
    ]);
  });
});
