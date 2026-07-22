import { buildAmpAuxQueryArgs } from '@/providers/amp/runtime/AmpAuxQueryRunner';

describe('buildAmpAuxQueryArgs', () => {
  it('passes the selected current Amp mode to one-shot requests', () => {
    expect(buildAmpAuxQueryArgs('amp:high', 'Summarize this note')).toEqual([
      '--mode',
      'high',
      '-x',
      'Summarize this note',
    ]);
  });

  it('uses medium for model ids that Amp does not own', () => {
    expect(buildAmpAuxQueryArgs('amp:rush', 'Fix this text')).toEqual([
      '--mode',
      'medium',
      '-x',
      'Fix this text',
    ]);
  });
});
