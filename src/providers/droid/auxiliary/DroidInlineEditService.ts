import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type ClaudianPlugin from '../../../main';
import { DroidAuxQueryRunner } from '../runtime/DroidAuxQueryRunner';

export class DroidInlineEditService extends QueryBackedInlineEditService {
  constructor(plugin: ClaudianPlugin) {
    super(new DroidAuxQueryRunner(plugin));
  }
}
