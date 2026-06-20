import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type ClaudianPlugin from '../../../main';
import { AmpAuxQueryRunner } from '../runtime/AmpAuxQueryRunner';

export class AmpInlineEditService extends QueryBackedInlineEditService {
  constructor(plugin: ClaudianPlugin) {
    super(new AmpAuxQueryRunner(plugin));
  }
}
