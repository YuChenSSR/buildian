import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type ClaudianPlugin from '../../../main';
import { DroidAuxQueryRunner } from '../runtime/DroidAuxQueryRunner';

export class DroidInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: ClaudianPlugin) {
    super(new DroidAuxQueryRunner(plugin));
  }
}
