import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { maybeGetGrokWorkspaceServices } from '../app/GrokWorkspaceServices';
import {
  GROK_DEFAULT_MODEL_ID,
  type GrokDiscoveredModel,
  normalizeGrokVisibleModels,
} from '../models';
import { GrokChatRuntime } from '../runtime/GrokChatRuntime';
import {
  getGrokProviderSettings,
  updateGrokProviderSettings,
} from '../settings';

export const grokSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const grokWorkspace = maybeGetGrokWorkspaceServices();
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const grokSettings = getGrokProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();

    new Setting(container).setName('Setup').setHeading();

    new Setting(container)
      .setName('Enable Grok Build')
      .setDesc('Launch `grok agent stdio` as a provider.')
      .addToggle((toggle) =>
        toggle
          .setValue(grokSettings.enabled)
          .onChange(async (value) => {
            updateGrokProviderSettings(settingsBag, { enabled: value });
            await context.plugin.saveSettings();
            context.refreshModelSelectors();
          })
      );

    const cliPathSetting = new Setting(container)
      .setName('CLI path')
      .setDesc('Optional absolute path to the Grok CLI for this computer. Leave empty to use `grok` from PATH.');
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

    const cliPathsByHost = { ...grokSettings.cliPathsByHost };
    const currentCliPath = grokSettings.cliPathsByHost[hostnameKey] || '';
    let cliPathInputEl: HTMLInputElement | null = null;

    const recycleGrokRuntime = async (): Promise<void> => {
      for (const view of context.plugin.getAllViews()) {
        const tabManager = view.getTabManager();
        if (tabManager?.broadcastToProviderTabs) {
          await tabManager.broadcastToProviderTabs('grok', (service) => Promise.resolve(service.cleanup()));
        } else {
          await tabManager?.broadcastToAllTabs((service) => Promise.resolve(service.cleanup()));
        }
        view.invalidateProviderCommandCaches?.(['grok']);
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

      updateGrokProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      grokWorkspace?.cliResolver?.reset();
      await recycleGrokRuntime();
      return true;
    };

    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(process.platform === 'win32'
          ? 'C:\\Users\\you\\.grok\\bin\\grok.exe'
          : '~/.grok/bin/grok')
        .setValue(currentCliPath)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('claudian-settings-cli-path-input');
      cliPathInputEl = text.inputEl;
      updateCliPathValidation(currentCliPath, text.inputEl);
    });

    new Setting(container).setName('Models').setHeading();

    const modelsContainer = container.createDiv({ cls: 'claudian-grok-models' });
    let loadingCatalog = false;
    let loadFailed = false;

    const persistVisibleModels = async (visibleModels: string[]): Promise<void> => {
      const normalized = normalizeGrokVisibleModels(
        visibleModels,
        getGrokProviderSettings(settingsBag).discoveredModels,
      );
      updateGrokProviderSettings(settingsBag, { visibleModels: normalized });
      await context.plugin.saveSettings();
      context.refreshModelSelectors();
      renderModels();
    };

    const persistModelAlias = async (rawId: string, alias: string): Promise<void> => {
      const current = getGrokProviderSettings(settingsBag);
      const nextAliases = { ...current.modelAliases };
      const trimmedAlias = alias.trim();
      if (trimmedAlias) {
        nextAliases[rawId] = trimmedAlias;
      } else {
        delete nextAliases[rawId];
      }

      updateGrokProviderSettings(settingsBag, { modelAliases: nextAliases });
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
      const runtime = new GrokChatRuntime(context.plugin);
      try {
        loadFailed = !(await runtime.ensureReady({ allowSessionCreation: false }));
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

    const getDisplayModels = (): GrokDiscoveredModel[] => {
      const current = getGrokProviderSettings(settingsBag);
      const discovered = current.discoveredModels;
      if (discovered.some(model => model.rawId === GROK_DEFAULT_MODEL_ID)) {
        return discovered;
      }
      return [
        {
          description: 'xAI coding agent',
          label: 'Grok Build',
          rawId: GROK_DEFAULT_MODEL_ID,
        },
        ...discovered,
      ];
    };

    const renderModels = (): void => {
      modelsContainer.empty();
      const current = getGrokProviderSettings(settingsBag);
      const visible = new Set(
        current.visibleModels.length > 0 ? current.visibleModels : [GROK_DEFAULT_MODEL_ID],
      );

      new Setting(modelsContainer)
        .setName('Discover Grok models')
        .setDesc(loadingCatalog
          ? 'Loading Grok model catalog...'
          : loadFailed
            ? 'Could not load Grok model catalog. Check the CLI path and login state.'
            : 'Fetch models and runtime commands from `grok agent stdio` without creating a chat session.')
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
        .setDesc('Choose which Grok models appear in the chat selector. If none are selected, Grok Build is shown by default.');

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
              const latest = getGrokProviderSettings(settingsBag);
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
    context.renderHiddenProviderCommandSetting(container, 'grok', {
      name: 'Hidden Commands',
      desc: 'Hide specific Grok runtime commands from the dropdown. Enter names without the leading slash, one per line.',
      placeholder: 'compact\nalways-approve\ncontext',
    });

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: 'provider:grok',
      heading: 'Environment',
      name: 'Grok environment',
      desc: 'Grok-owned runtime variables only. Use this for XAI_API_KEY, GROK_CODE_XAI_API_KEY, GROK_HOME, and Grok-specific configuration.',
      placeholder: 'XAI_API_KEY=your-key\nGROK_HOME=/path/to/grok',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'grok'),
    });
  },
};
