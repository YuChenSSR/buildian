import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type ClaudianPlugin from '../../../main';
import { decodeGrokModelId } from '../models';
import { GrokAuxQueryRunner } from '../runtime/GrokAuxQueryRunner';
import { grokChatUIConfig } from '../ui/GrokChatUIConfig';

export class GrokTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: ClaudianPlugin) {
    super({
      createRunner: () => new GrokAuxQueryRunner(plugin),
      resolveModel: () => {
        const settings = plugin.settings as unknown as Record<string, unknown>;
        const titleModel = typeof settings.titleGenerationModel === 'string'
          ? settings.titleGenerationModel
          : '';
        if (!grokChatUIConfig.ownsModel(titleModel, settings)) {
          return undefined;
        }

        return decodeGrokModelId(titleModel) ?? undefined;
      },
    });
  }
}
