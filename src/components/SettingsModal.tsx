import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';
import { ModalOverlay } from './ModalOverlay';
import { FieldError } from './FieldError';
import { useLanguage } from '../hooks/useLanguage';
import { ThemeContext, type Theme } from '../contexts/ThemeContext';
import { LanguageContext, resolveLanguage } from '../contexts/LanguageContext';
import { getVersion } from '@tauri-apps/api/app';
import { getSettings, updateSettings } from '../hooks/useIpc';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { asSentence, ipcErrorToString } from '../utils/errors';
import type { AutostartError, LangCode } from '../types';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The saved settings could not be read when the dialog opened; it then closes. Gets the
   *  backend's error as it is: the app says it as a toast in its language. A failed Save is
   *  shown inside the dialog instead. */
  onError?: (msg: string) => void;
}

/** The saved language setting: '' means "Same as Windows". */
type LanguagePreference = LangCode | '';

/** The settings this dialog edits. Save writes exactly these fields. */
interface DialogValues {
  theme: Theme;
  language: LanguagePreference;
  autostart: boolean;
  start_in_tray: boolean;
  confirm_on_close: boolean;
  autotype_delay_ms: number;
}

const MAX_AUTOTYPE_DELAY_MS = 1000;
const TITLE_ID = 'settings-modal-title';
const VERSION_ID = 'settings-version';

function toLanguagePreference(raw: string): LanguagePreference {
  return raw === 'en' || raw === 'uk' || raw === 'de' ? raw : '';
}

function toDelay(raw: string): number {
  return Math.max(0, Math.min(MAX_AUTOTYPE_DELAY_MS, Math.floor(Number(raw) || 0)));
}

function hintId(controlId: string): string {
  return `${controlId}-hint`;
}

// ── Layout pieces ─────────────────────────────────────────────────────────

/** A titled group of settings. Screen readers say the title when focus enters it. */
function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <fieldset className="settings-group">
      <legend>{title}</legend>
      <div className="settings-card">{children}</div>
    </fieldset>
  );
}

/**
 * One setting: the label (and an optional hint under it) on the left, the
 * control on the right. The control must use `controlId` as its id and, when
 * there is a hint, `aria-describedby={hintId(controlId)}`. `message` goes under
 * the hint: a live region about this setting (see FieldError).
 */
function SettingsRow({
  controlId,
  label,
  hint,
  message,
  children,
}: {
  controlId: string;
  label: string;
  hint?: string;
  message?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <label htmlFor={controlId}>{label}</label>
        {hint && (
          <p id={hintId(controlId)} className="settings-row-hint">
            {hint}
          </p>
        )}
        {message}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────

export function SettingsModal({
  isOpen,
  onClose,
  onError,
}: SettingsModalProps): React.ReactElement | null {
  const { t, tf } = useLanguage();
  const { theme, setTheme } = useContext(ThemeContext);
  const { language, setLanguage, systemLanguage } = useContext(LanguageContext);

  // null until the saved settings are loaded: the dialog appears only then, so
  // focus enters it once and screen readers read its title and first control together.
  const [values, setValues] = useState<DialogValues | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Theme and language shown when the dialog opened; Cancel brings them back.
  const shownAtOpen = useRef<{ theme: Theme; language: LangCode } | null>(null);
  // Which change of "Start with Windows" Windows refused at the last Save, if any.
  const [autostartError, setAutostartError] = useState<AutostartError | null>(null);
  const autostartRef = useRef<HTMLInputElement>(null);
  // Why the last Save could not write the settings (the backend's error), if it failed.
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setValues(null);
      setAutostartError(null);
      setSaveError(null);
      return;
    }
    // Read once, as they are at the moment the dialog opens.
    shownAtOpen.current = { theme, language };
    let cancelled = false;
    Promise.all([getSettings(), getVersion().catch(() => null)])
      .then(([s, version]) => {
        if (cancelled) return;
        setAppVersion(version);
        setValues({
          theme,
          language: toLanguagePreference(s.language),
          autostart: s.autostart,
          start_in_tray: s.start_in_tray,
          confirm_on_close: s.confirm_on_close,
          autotype_delay_ms: s.autotype_delay_ms,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError?.(ipcErrorToString(err));
        onClose();
      });
    return () => {
      cancelled = true;
    };
    // Only opening the dialog starts a load. Theme and language are read as they
    // are at that moment on purpose: the previews must not restart it.
  }, [isOpen]);

  /** Cancel, Escape and a click outside: show the theme and language from before, save nothing. */
  const handleCancel = useCallback(() => {
    // A save in progress would write the new values after the old ones are shown.
    if (saving) return;
    const shown = shownAtOpen.current;
    if (shown) {
      setTheme(shown.theme);
      setLanguage(shown.language);
    }
    onClose();
  }, [saving, setTheme, setLanguage, onClose]);

  const handleSave = useCallback(async () => {
    if (!values || saving) return;
    setSaving(true);
    // The message of an earlier Save goes first, so that a new one is announced again.
    setAutostartError(null);
    setSaveError(null);
    try {
      // Only this dialog's fields; sort order and window size stay as they are.
      const outcome = await updateSettings(values);
      const refused = outcome?.autostart_error ?? null;
      if (!refused) {
        onClose();
        return;
      }
      // Windows refused to turn "Start with Windows" on or off. It keeps its previous value
      // and everything else is saved, so Cancel no longer brings back the theme and language
      // from before. The dialog stays open: the check box shows the saved value before it gets
      // the focus, so that the screen reader reads its new state once, and only then the
      // message is set, as in the create dialog (FieldError).
      shownAtOpen.current = {
        theme: values.theme,
        language: resolveLanguage(values.language, systemLanguage),
      };
      const keptOn = refused === 'cannot_turn_off';
      flushSync(() => setValues((v) => (v ? { ...v, autostart: keptOn } : v)));
      autostartRef.current?.focus();
      setAutostartError(refused);
    } catch (err: unknown) {
      // The settings file could not be written: nothing is saved, in the file or in memory.
      // The dialog stays open with every change in it, so that Save can be tried again, and
      // Cancel still brings back the theme and language from before. Focus stays where it is;
      // the message above the buttons is a live region (FieldError), read once. A toast would
      // be outside the dialog and gone after 2 s.
      setSaveError(ipcErrorToString(err));
    } finally {
      setSaving(false);
    }
  }, [values, saving, onClose, systemLanguage]);

  useModalKeyboard(isOpen, { onEscape: handleCancel, onCtrlEnter: handleSave });

  if (!isOpen || !values) return null;

  const update = (patch: Partial<DialogValues>) =>
    setValues((v) => (v ? { ...v, ...patch } : v));

  const changeTheme = (next: Theme) => {
    update({ theme: next });
    setTheme(next); // shown at once, saved only by Save
  };

  const changeLanguage = (next: LanguagePreference) => {
    update({ language: next });
    setLanguage(resolveLanguage(next, systemLanguage)); // shown at once, saved only by Save
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={handleCancel}
      titleId={TITLE_ID}
      describedBy={appVersion ? VERSION_ID : undefined}
      className="settings-dialog"
    >
      <h2 id={TITLE_ID}>{t('settingsTitle')}</h2>

      <SettingsGroup title={t('settingsAppearanceGroup')}>
        <SettingsRow controlId="settings-theme" label={t('themeLabel')}>
          <div className="select-wrap">
            <select
              id="settings-theme"
              value={values.theme}
              onChange={(e) => changeTheme(e.target.value === 'light' ? 'light' : 'dark')}
            >
              <option value="dark">{t('darkTheme')}</option>
              <option value="light">{t('lightTheme')}</option>
            </select>
          </div>
        </SettingsRow>

        <SettingsRow controlId="settings-lang" label={t('languageLabel')}>
          <div className="select-wrap">
            <select
              id="settings-lang"
              value={values.language}
              onChange={(e) => changeLanguage(toLanguagePreference(e.target.value))}
            >
              <option value="">{t('autoLanguage')}</option>
              <option value="en" lang="en">English</option>
              <option value="uk" lang="uk">Українська</option>
              <option value="de" lang="de">Deutsch</option>
            </select>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t('settingsStartupGroup')}>
        <SettingsRow
          controlId="settings-autostart"
          label={t('autostartLabel')}
          hint={t('autostartHint')}
          message={
            <FieldError
              id="settings-autostart-error"
              message={
                autostartError === 'cannot_turn_on'
                  ? t('autostartTurnOnFailed')
                  : autostartError === 'cannot_turn_off'
                    ? t('autostartTurnOffFailed')
                    : undefined
              }
            />
          }
        >
          <input
            ref={autostartRef}
            id="settings-autostart"
            type="checkbox"
            aria-describedby={hintId('settings-autostart')}
            checked={values.autostart}
            onChange={(e) => update({ autostart: e.target.checked })}
          />
        </SettingsRow>

        <SettingsRow
          controlId="settings-tray"
          label={t('startInTrayLabel')}
          hint={t('startInTrayHint')}
        >
          <input
            id="settings-tray"
            type="checkbox"
            aria-describedby={hintId('settings-tray')}
            checked={values.start_in_tray}
            onChange={(e) => update({ start_in_tray: e.target.checked })}
          />
        </SettingsRow>

        <SettingsRow
          controlId="settings-confirm"
          label={t('confirmOnCloseLabel')}
          hint={t('confirmOnCloseHint')}
        >
          <input
            id="settings-confirm"
            type="checkbox"
            aria-describedby={hintId('settings-confirm')}
            checked={values.confirm_on_close}
            onChange={(e) => update({ confirm_on_close: e.target.checked })}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t('settingsAutotypeGroup')}>
        <SettingsRow
          controlId="settings-autotype-delay"
          label={t('autotypeDelayLabel')}
          hint={t('autotypeDelayHint')}
        >
          <input
            id="settings-autotype-delay"
            type="number"
            min={0}
            max={MAX_AUTOTYPE_DELAY_MS}
            step={1}
            aria-describedby={hintId('settings-autotype-delay')}
            value={values.autotype_delay_ms}
            onChange={(e) => update({ autotype_delay_ms: toDelay(e.target.value) })}
          />
        </SettingsRow>
      </SettingsGroup>

      <FieldError
        id="settings-save-error"
        message={saveError === null ? undefined : tf.settingsSaveFailed(asSentence(saveError))}
      />

      <div className="settings-footer">
        {appVersion && (
          <p id={VERSION_ID} className="settings-version">
            {tf.appVersion(appVersion)}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            id="settings-cancel"
            className="btn-secondary"
            onClick={handleCancel}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            id="settings-save"
            className="btn-primary"
            // aria-disabled, not disabled: a disabled button would drop the focus
            // out of the dialog while saving.
            aria-disabled={saving || undefined}
            onClick={() => void handleSave()}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
