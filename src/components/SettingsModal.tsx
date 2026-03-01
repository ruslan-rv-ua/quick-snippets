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
import { getSettings, saveSettings } from '../hooks/useIpc';
import type { Settings, LangCode } from '../types';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps): React.ReactElement | null {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { language, setLanguage } = useContext(LanguageContext);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSettings(null);
    getSettings()
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  // After async load resolves, move focus to the first interactive element
  useEffect(() => {
    if (!isOpen || loading) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
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
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [settings, saving, theme, language, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSave();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, handleSave]);

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
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
