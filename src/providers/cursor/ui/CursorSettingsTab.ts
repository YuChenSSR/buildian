import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { maybeGetCursorWorkspaceServices } from '../app/CursorWorkspaceServices';
import {
  CURSOR_DEFAULT_MODEL_ID,
  CURSOR_PROVIDER_ID,
  type CursorDiscoveredModel,
  normalizeCursorVisibleModels,
} from '../models';
import { CursorChatRuntime } from '../runtime/CursorChatRuntime';
import {
  getCursorProviderSettings,
  updateCursorProviderSettings,
} from '../settings';

export const cursorSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const cursorWorkspace = maybeGetCursorWorkspaceServices();
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const cursorSettings = getCursorProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();

    new Setting(container).setName('Setup').setHeading();

    new Setting(container)
      .setName('Enable Cursor agent')
      .setDesc('Launch the Cursor Agent ACP runtime (`cursor-agent acp`).')
      .addToggle((toggle) =>
        toggle
          .setValue(cursorSettings.enabled)
          .onChange(async (value) => {
            updateCursorProviderSettings(settingsBag, { enabled: value });
            await context.plugin.saveSettings();
            context.refreshModelSelectors();
          })
      );

    const cliPathSetting = new Setting(container)
      .setName('CLI path')
      .setDesc('Optional absolute path to the Cursor Agent CLI for this computer. Leave empty to use `cursor-agent` from PATH.');
    const validationEl = container.createDiv({
      cls: 'claudian-cli-path-validation claudian-setting-validation claudian-setting-validation-error claudian-hidden',
    });

    const validatePath = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const expandedPath = expandHomePath(trimmed);
      if (!fs.existsSync(expandedPath)) {
        return 'Path does not exist';
      }

      const stat = fs.statSync(expandedPath);
      if (!stat.isFile()) {
        return 'Path must point to a file';
      }

      return null;
    };

    const updateCliPathValidation = (value: string, inputEl?: HTMLInputElement): boolean => {
      const error = validatePath(value);
      if (error) {
        validationEl.setText(error);
        validationEl.toggleClass('claudian-hidden', false);
        inputEl?.toggleClass('claudian-input-error', true);
        return false;
      }

      validationEl.toggleClass('claudian-hidden', true);
      inputEl?.toggleClass('claudian-input-error', false);
      return true;
    };

    const cliPathsByHost = { ...cursorSettings.cliPathsByHost };
    const currentCliPath = cursorSettings.cliPathsByHost[hostnameKey] || '';
    let cliPathInputEl: HTMLInputElement | null = null;

    const recycleCursorRuntime = async (): Promise<void> => {
      for (const view of context.plugin.getAllViews()) {
        const tabManager = view.getTabManager();
        if (tabManager?.broadcastToProviderTabs) {
          await tabManager.broadcastToProviderTabs(CURSOR_PROVIDER_ID, (service) => Promise.resolve(service.cleanup()));
        } else {
          await tabManager?.broadcastToAllTabs((service) => Promise.resolve(service.cleanup()));
        }
        view.invalidateProviderCommandCaches?.([CURSOR_PROVIDER_ID]);
        view.refreshModelSelector?.();
      }
    };

    const persistCliPath = async (value: string): Promise<boolean> => {
      const isValid = updateCliPathValidation(value, cliPathInputEl ?? undefined);
      if (!isValid) {
        return false;
      }

      const trimmed = value.trim();
      if (trimmed) {
        cliPathsByHost[hostnameKey] = trimmed;
      } else {
        delete cliPathsByHost[hostnameKey];
      }

      updateCursorProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      cursorWorkspace?.cliResolver?.reset();
      await recycleCursorRuntime();
      return true;
    };

    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(process.platform === 'win32'
          ? 'C:\\Users\\you\\.local\\bin\\cursor-agent.exe'
          : '~/.local/bin/cursor-agent')
        .setValue(currentCliPath)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('claudian-settings-cli-path-input');
      cliPathInputEl = text.inputEl;
      updateCliPathValidation(currentCliPath, text.inputEl);
    });

    new Setting(container).setName('Models').setHeading();

    const modelsContainer = container.createDiv({ cls: 'claudian-cursor-models' });
    let loadingCatalog = false;
    let loadFailed = false;

    const persistVisibleModels = async (visibleModels: string[]): Promise<void> => {
      const normalized = normalizeCursorVisibleModels(
        visibleModels,
        getCursorProviderSettings(settingsBag).discoveredModels,
      );
      updateCursorProviderSettings(settingsBag, { visibleModels: normalized });
      await context.plugin.saveSettings();
      context.refreshModelSelectors();
      renderModels();
    };

    const persistModelAlias = async (rawId: string, alias: string): Promise<void> => {
      const current = getCursorProviderSettings(settingsBag);
      const nextAliases = { ...current.modelAliases };
      const trimmedAlias = alias.trim();
      if (trimmedAlias) {
        nextAliases[rawId] = trimmedAlias;
      } else {
        delete nextAliases[rawId];
      }

      updateCursorProviderSettings(settingsBag, { modelAliases: nextAliases });
      await context.plugin.saveSettings();
      context.refreshModelSelectors();
      renderModels();
    };

    const loadModelCatalog = async (): Promise<void> => {
      if (loadingCatalog) {
        return;
      }

      loadingCatalog = true;
      loadFailed = false;
      renderModels();
      const runtime = new CursorChatRuntime(context.plugin);
      try {
        loadFailed = !(await runtime.ensureReady({ allowSessionCreation: true }));
        if (!loadFailed) {
          context.refreshModelSelectors();
        }
      } catch {
        loadFailed = true;
      } finally {
        runtime.cleanup();
        loadingCatalog = false;
        renderModels();
      }
    };

    const getDisplayModels = (): CursorDiscoveredModel[] => {
      const current = getCursorProviderSettings(settingsBag);
      const discovered = current.discoveredModels;
      if (discovered.some(model => model.rawId === CURSOR_DEFAULT_MODEL_ID)) {
        return discovered;
      }
      return [
        {
          description: 'Cursor Agent default model',
          label: 'Opus 4.6 Max Thinking',
          rawId: CURSOR_DEFAULT_MODEL_ID,
        },
        ...discovered,
      ];
    };

    const renderModels = (): void => {
      modelsContainer.empty();
      const current = getCursorProviderSettings(settingsBag);
      const visible = new Set(
        current.visibleModels.length > 0 ? current.visibleModels : [CURSOR_DEFAULT_MODEL_ID],
      );

      new Setting(modelsContainer)
        .setName('Discover CLI models')
        .setDesc(loadingCatalog
            ? 'Loading model catalog...'
            : loadFailed
              ? 'Could not load the model catalog. Check the CLI path and login state.'
              : 'Fetch models and runtime commands from `cursor-agent acp` using a temporary ACP session.')
        .addButton((button) => {
          button
            .setButtonText(loadingCatalog ? 'Loading...' : 'Load catalog')
            .setDisabled(loadingCatalog)
            .onClick(() => {
              void loadModelCatalog();
            });
        });

      new Setting(modelsContainer)
        .setName('Visible models')
        .setDesc('Choose which Cursor models appear in the chat selector. If none are selected, auto is shown.');

      for (const model of getDisplayModels()) {
        const row = new Setting(modelsContainer)
          .setName(current.modelAliases[model.rawId] || model.label)
          .setDesc(model.description
            ? `${model.rawId} - ${model.description}`
            : model.rawId);

        row.addToggle((toggle) => {
          toggle
            .setValue(visible.has(model.rawId))
            .onChange(async (value) => {
              const latest = getCursorProviderSettings(settingsBag);
              const next = value
                ? [...new Set([...latest.visibleModels, model.rawId])]
                : latest.visibleModels.filter((entry) => entry !== model.rawId);
              await persistVisibleModels(next);
            });
        });

        row.addText((text) => {
          text
            .setPlaceholder(model.label)
            .setValue(current.modelAliases[model.rawId] ?? '')
            .onChange((value) => {
              text.inputEl.dataset.pendingAlias = value;
            });
          text.inputEl.addEventListener('blur', () => {
            void persistModelAlias(model.rawId, text.inputEl.value);
          });
        });
      }
    };

    renderModels();

    new Setting(container).setName('Commands').setHeading();
    context.renderHiddenProviderCommandSetting(container, CURSOR_PROVIDER_ID, {
      name: 'Hidden Commands',
      desc: 'Hide specific runtime commands from the dropdown. Enter names without the leading slash, one per line.',
      placeholder: 'new-chat\nsummarize\ncontext',
    });

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: `provider:${CURSOR_PROVIDER_ID}`,
      heading: 'Environment',
      name: 'CLI environment',
      desc: 'Runtime-specific variables only. Use this for CURSOR_API_KEY, CURSOR_HOME, and CLI-specific configuration.',
      placeholder: 'CURSOR_API_KEY=your-key\nCURSOR_HOME=/path/to/cursor',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, CURSOR_PROVIDER_ID),
    });
  },
};
