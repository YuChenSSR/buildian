import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { maybeGetAmpWorkspaceServices } from '../app/AmpWorkspaceServices';
import { AMP_PROVIDER_ID } from '../models';
import {
  getAmpProviderSettings,
  updateAmpProviderSettings,
} from '../settings';

export const ampSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const ampWorkspace = maybeGetAmpWorkspaceServices();
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const ampSettings = getAmpProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();

    new Setting(container).setName('Setup').setHeading();

    new Setting(container)
      .setName('Enable amp agent')
      .setDesc('Launch amp through the acp-amp adapter. Requires amp CLI login and a paid amp credits balance.')
      .addToggle((toggle) =>
        toggle
          .setValue(ampSettings.enabled)
          .onChange(async (value) => {
            updateAmpProviderSettings(settingsBag, { enabled: value });
            await context.plugin.saveSettings();
            context.refreshModelSelectors();
          })
      );

    const cliPathSetting = new Setting(container)
      .setName('Adapter path')
      .setDesc('Optional absolute path to acp-amp or npx for this computer. Leave empty to use acp-amp from your shell path, then npx @superagenticai/acp-amp as a fallback.');
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

    const cliPathsByHost = { ...ampSettings.cliPathsByHost };
    const currentCliPath = ampSettings.cliPathsByHost[hostnameKey] || '';
    let cliPathInputEl: HTMLInputElement | null = null;

    const recycleAmpRuntime = async (): Promise<void> => {
      for (const view of context.plugin.getAllViews()) {
        const tabManager = view.getTabManager();
        if (tabManager?.broadcastToProviderTabs) {
          await tabManager.broadcastToProviderTabs(AMP_PROVIDER_ID, (service) => Promise.resolve(service.cleanup()));
        } else {
          await tabManager?.broadcastToAllTabs((service) => Promise.resolve(service.cleanup()));
        }
        view.invalidateProviderCommandCaches?.([AMP_PROVIDER_ID]);
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

      updateAmpProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      ampWorkspace?.cliResolver?.reset();
      await recycleAmpRuntime();
      return true;
    };

    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(process.platform === 'win32'
          ? 'C:\\Users\\you\\.local\\bin\\acp-amp.exe'
          : '~/.local/bin/acp-amp')
        .setValue(currentCliPath)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('claudian-settings-cli-path-input');
      cliPathInputEl = text.inputEl;
      updateCliPathValidation(currentCliPath, text.inputEl);
    });

    new Setting(container)
      .setName('Prerequisites')
      .setDesc('Install and log in with Amp CLI (`amp login`). For the ACP adapter, install acp-amp or rely on npx. ACP usage consumes paid Amp credits.');

    new Setting(container).setName('Commands').setHeading();
    context.renderHiddenProviderCommandSetting(container, AMP_PROVIDER_ID, {
      name: 'Hidden Commands',
      desc: 'Hide specific runtime commands from the dropdown. Enter names without the leading slash, one per line.',
      placeholder: 'init',
    });

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: `provider:${AMP_PROVIDER_ID}`,
      heading: 'Environment',
      name: 'CLI environment',
      desc: 'Runtime-specific variables only. Use this for PATH, AMP_API_KEY, ACP_AMP_DRIVER, proxy, and certificate configuration.',
      placeholder: 'AMP_API_KEY=...\nACP_AMP_DRIVER=python\nHTTPS_PROXY=http://127.0.0.1:7890',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, AMP_PROVIDER_ID),
    });
  },
};
