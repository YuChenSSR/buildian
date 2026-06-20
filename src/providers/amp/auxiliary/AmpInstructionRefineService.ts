import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type ClaudianPlugin from '../../../main';
import { AmpAuxQueryRunner } from '../runtime/AmpAuxQueryRunner';

export class AmpInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: ClaudianPlugin) {
    super(new AmpAuxQueryRunner(plugin));
  }
}
