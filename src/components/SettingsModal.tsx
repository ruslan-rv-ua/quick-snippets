import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { ThemeContext } from '../contexts/ThemeContext';
import { LanguageContext } from '../contexts/LanguageContext';
import { getVersion } from '@tauri-apps/api/app';
import { getSettings, saveSettings } from '../hooks/useIpc';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { FOCUSABLE_SELECTORS } from '../utils/focusable';
import { ipcErrorToString } from '../utils/errors';
import type { Settings, LangCode } from '../types';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onError?: (msg: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  onError,
}: SettingsModalProps): React.ReactElement | null {
  const { t, tf } = useLanguage();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { language, setLanguage } = useContext(LanguageContext);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSettings(null);
    Promise.all([
      getSettings(),
      getVersion().catch(() => null),
    ]).then(([s, v]) => {
      setSettings(s);
      setAppVersion(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isOpen]);

  // After async load resolves, move focus to the first interactive element
  useEffect(() => {
    if (!isOpen || loading) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
    (first ?? el).focus();
  }, [isOpen, loading]);

  const handleSave = useCallback(async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const updated: Settings = {
        ...settings,
        theme,
        language,
      };
      await saveSettings(updated);
      // Apply language & theme immediately (already applied via context)
      onClose();
    } catch (err: unknown) {
      onError?.(ipcErrorToString(err));
    } finally {
      setSaving(false);
    }
  }, [settings, saving, theme, language, onClose]);

  useModalKeyboard(isOpen, { onEscape: onClose, onCtrlEnter: handleSave });

  if (!isOpen) return null;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      titleId="settings-modal-title"
      busy={loading}
    >
      <div ref={dialogRef}>
      <h2 id="settings-modal-title">{t('settingsTitle')}</h2>

      {loading ? (
        <p>…</p>
      ) : (
          <>
            {/* Theme */}
            <div className="form-field">
              <span>{t('themeLabel')}</span>
              <div className="toggle-group" role="group" aria-label={t('themeLabel')}>
                <button
                  type="button"
                  className="toggle-btn"
                  aria-pressed={theme === 'dark'}
                  onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                >
                  {t('darkTheme')}
                </button>
                <button
                  type="button"
                  className="toggle-btn"
                  aria-pressed={theme === 'light'}
                  onClick={() => { if (theme !== 'light') toggleTheme(); }}
                >
                  {t('lightTheme')}
                </button>
              </div>
            </div>

            {/* Language */}
            <div className="form-field">
              <label htmlFor="settings-lang">{t('languageLabel')}</label>
              <select
                id="settings-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as LangCode)}
              >
                <option value="">{t('autoLanguage')}</option>
                <option value="en">English</option>
                <option value="uk">Українська</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="form-field">
              <label htmlFor="settings-tray">
                <input
                  id="settings-tray"
                  type="checkbox"
                  checked={settings?.start_in_tray ?? false}
                  onChange={(e) =>
                    setSettings((s) => s ? { ...s, start_in_tray: e.target.checked } : s)
                  }
                />
                {' '}{t('startInTrayLabel')}
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="settings-autostart">
                <input
                  id="settings-autostart"
                  type="checkbox"
                  checked={settings?.autostart ?? false}
                  onChange={(e) =>
                    setSettings((s) => s ? { ...s, autostart: e.target.checked } : s)
                  }
                />
                {' '}{t('autostartLabel')}
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="settings-confirm">
                <input
                  id="settings-confirm"
                  type="checkbox"
                  checked={settings?.confirm_on_close ?? false}
                  onChange={(e) =>
                    setSettings((s) => s ? { ...s, confirm_on_close: e.target.checked } : s)
                  }
                />
                {' '}{t('confirmOnCloseLabel')}
              </label>
            </div>

            {/* Autotype delay */}
            <div className="form-field">
              <label htmlFor="settings-autotype-delay">
                {t('autotypeDelayLabel')}
              </label>
              <input
                id="settings-autotype-delay"
                type="number"
                min={0}
                max={1000}
                step={1}
                value={settings?.autotype_delay_ms ?? 1}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0)));
                  setSettings((s) => s ? { ...s, autotype_delay_ms: v } : s);
                }}
                style={{ width: '5em' }}
              />
            </div>

            <p className="settings-hint">
              {t('restartHint')}
            </p>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {t('save')}
              </button>
            </div>

            {appVersion && (
              <p className="settings-version">{tf.appVersion(appVersion)}</p>
            )}
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
