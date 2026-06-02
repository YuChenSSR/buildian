import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type ClaudianPlugin from '../../../main';
import { GrokAuxQueryRunner } from '../runtime/GrokAuxQueryRunner';

export class GrokInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: ClaudianPlugin) {
    super(new GrokAuxQueryRunner(plugin));
  }
}
