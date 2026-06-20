import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type ClaudianPlugin from '../../../main';
import { AMP_MODEL_ID } from '../models';
import { AmpAuxQueryRunner } from '../runtime/AmpAuxQueryRunner';

export class AmpTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: ClaudianPlugin) {
    super({
      createRunner: () => new AmpAuxQueryRunner(plugin),
      resolveModel: () => AMP_MODEL_ID,
    });
  }
}
