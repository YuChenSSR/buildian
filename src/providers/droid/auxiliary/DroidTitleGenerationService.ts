import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type ClaudianPlugin from '../../../main';
import { decodeDroidModelId } from '../models';
import { DroidAuxQueryRunner } from '../runtime/DroidAuxQueryRunner';
import { droidChatUIConfig } from '../ui/DroidChatUIConfig';

export class DroidTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: ClaudianPlugin) {
    super({
      createRunner: () => new DroidAuxQueryRunner(plugin),
      resolveModel: () => {
        const settings = plugin.settings as unknown as Record<string, unknown>;
        const titleModel = typeof settings.titleGenerationModel === 'string'
          ? settings.titleGenerationModel
          : '';
        if (!droidChatUIConfig.ownsModel(titleModel, settings)) {
          return undefined;
        }

        return decodeDroidModelId(titleModel) ?? undefined;
      },
    });
  }
}
