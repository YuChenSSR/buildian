import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type ClaudianPlugin from '../../../main';
import { GrokAuxQueryRunner } from '../runtime/GrokAuxQueryRunner';

export class GrokInlineEditService extends QueryBackedInlineEditService {
  constructor(plugin: ClaudianPlugin) {
    super(new GrokAuxQueryRunner(plugin));
  }
}
