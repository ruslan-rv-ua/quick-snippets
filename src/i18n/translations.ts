import type { LangCode } from '../types';

/** Shape of a single locale's translations. */
export interface TranslationMap {
  // ── Search ───────────────────────────────────────────────────────────────
  searchPlaceholder: string;
  noResults: string;
  nothingSelected: string;

  // ── Actions ──────────────────────────────────────────────────────────────
  copy: string;
  save: string;
  cancel: string;
  delete: string;
  quit: string;

  // ── Feedback toasts ──────────────────────────────────────────────────────
  copySuccess: string;
  saveSuccess: string;
  deleteSuccess: string;

  // ── Snippet form labels ──────────────────────────────────────────────────
  titleLabel: string;
  contentLabel: string;
  passwordLabel: string;
  confirmPasswordLabel: string;
  encrypted: string;
  /** Small helper word used in aria announcements, e.g. "1 of 41". */
  of: string;

  // ── Validation messages ──────────────────────────────────────────────────
  titleValidation: string;
  titleDuplicate: string;
  contentValidation: string;
  passwordMismatch: string;
  wrongPassword: string;
  decryptError: string;
  enterPassword: string;

  // ── CRUD headings ────────────────────────────────────────────────────────
  createSnippet: string;
  editSnippet: string;
  deleteSnippet: string;

  // ── Empty states ──────────────────────────────────────────────────────────
  noSnippets: string;

  // ── Settings ─────────────────────────────────────────────────────────────
  settingsTitle: string;
  themeLabel: string;
  languageLabel: string;
  startInTrayLabel: string;
  autostartLabel: string;
  confirmOnCloseLabel: string;
  darkTheme: string;
  lightTheme: string;
  autoLanguage: string;
  restartHint: string;

  // ── Exit / close dialog ──────────────────────────────────────────────────
  exitConfirmTitle: string;
  exitConfirmMessage: string;
  cannotUndo: string;

  // ── Warnings / errors ────────────────────────────────────────────────────
  hotkeyWarning: string;
  decrypting: string;
  corruptedDb: string;
  corruptedSettings: string;

  // ── Parametrized strings ─────────────────────────────────────────────────
  /** `n` — number of results, `query` — search query. */
  searchResults: (n: number, query: string) => string;
  /** Pluralised count, e.g. "1 snippet" / "5 snippets". */
  snippetCount: (n: number) => string;
  /** Accessible label for a snippet row. */
  snippetLabel: (title: string, encrypted: boolean) => string;
}

const en: TranslationMap = {
  // Search
  searchPlaceholder: 'Search snippets…',
  noResults: 'No results found',
  nothingSelected: 'Select a snippet to preview',

  // Actions
  copy: 'Copy',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  quit: 'Quit',

  // Toasts
  copySuccess: 'Copied',
  saveSuccess: 'Saved',
  deleteSuccess: 'Deleted',

  // Form labels
  titleLabel: 'Title',
  contentLabel: 'Content',
  passwordLabel: 'Password',
  confirmPasswordLabel: 'Confirm password',
  encrypted: 'Encrypted',

  of: 'of',

  // Validation
  titleValidation: 'Title must be 3–50 characters',
  titleDuplicate: 'A snippet with this title already exists',
  contentValidation: 'Content must not be empty',
  passwordMismatch: 'Passwords do not match',
  wrongPassword: 'Wrong password',
  decryptError: 'Failed to decrypt snippet',
  enterPassword: 'Enter password to decrypt',

  // CRUD headings
  createSnippet: 'Create snippet',
  editSnippet: 'Edit snippet',
  deleteSnippet: 'Delete snippet',

  // Empty states
  noSnippets: 'No snippets yet — create one!',

  // Settings
  settingsTitle: 'Settings',
  themeLabel: 'Theme',
  languageLabel: 'Language',
  startInTrayLabel: 'Start in system tray',
  autostartLabel: 'Start with Windows',
  confirmOnCloseLabel: 'Confirm before closing',
  darkTheme: 'Dark',
  lightTheme: 'Light',
  autoLanguage: 'Auto (system)',
  restartHint: 'Some settings take effect after restart',

  // Exit dialog
  exitConfirmTitle: 'Quit QuickSnippets?',
  exitConfirmMessage: 'The application will close.',
  cannotUndo: 'This action cannot be undone',

  // Warnings / errors
  hotkeyWarning: 'Global hotkey could not be registered',
  decrypting: 'Decrypting…',
  corruptedDb: 'Database appears corrupted — back it up before continuing',
  corruptedSettings: 'Settings file is invalid — defaults have been applied',

  // Parametrized
  searchResults: (n, query) =>
    n === 1 ? `1 result for "${query}"` : `${n} results for "${query}"`,
  snippetCount: (n) => (n === 1 ? '1 snippet' : `${n} snippets`),
  snippetLabel: (title, encrypted) =>
    encrypted ? `${title} (encrypted)` : title,
};

const uk: TranslationMap = {
  // Search
  searchPlaceholder: 'Пошук сніпетів…',
  noResults: 'Нічого не знайдено',
  nothingSelected: 'Виберіть сніпет для перегляду',

  // Actions
  copy: 'Копіювати',
  save: 'Зберегти',
  cancel: 'Скасувати',
  delete: 'Видалити',
  quit: 'Вийти',

  // Toasts
  copySuccess: 'Скопійовано',
  saveSuccess: 'Збережено',
  deleteSuccess: 'Видалено',

  // Form labels
  titleLabel: 'Назва',
  contentLabel: 'Вміст',
  passwordLabel: 'Пароль',
  confirmPasswordLabel: 'Підтвердити пароль',
  encrypted: 'Зашифровано',

  of: 'з',

  // Validation
  titleValidation: 'Назва має бути від 3 до 50 символів',
  titleDuplicate: 'Сніпет з такою назвою вже існує',
  contentValidation: 'Вміст не може бути порожнім',
  passwordMismatch: 'Паролі не збігаються',
  wrongPassword: 'Невірний пароль',
  decryptError: 'Помилка розшифрування сніпета',
  enterPassword: 'Введіть пароль для розшифрування',

  // CRUD headings
  createSnippet: 'Створити сніпет',
  editSnippet: 'Редагувати сніпет',
  deleteSnippet: 'Видалити сніпет',

  // Empty states
  noSnippets: 'Сніпетів ще немає — створіть перший!',

  // Settings
  settingsTitle: 'Налаштування',
  themeLabel: 'Тема',
  languageLabel: 'Мова',
  startInTrayLabel: 'Запускати у треї',
  autostartLabel: 'Запускати з Windows',
  confirmOnCloseLabel: 'Підтверджувати закриття',
  darkTheme: 'Темна',
  lightTheme: 'Світла',
  autoLanguage: 'Авто (системна)',
  restartHint: 'Деякі налаштування застосуються після перезапуску',

  // Exit dialog
  exitConfirmTitle: 'Вийти з QuickSnippets?',
  exitConfirmMessage: 'Застосунок буде закрито.',
  cannotUndo: 'Цю дію неможливо скасувати',

  // Warnings / errors
  hotkeyWarning: 'Не вдалося зареєструвати глобальне гарячу клавішу',
  decrypting: 'Розшифрування…',
  corruptedDb: 'База даних пошкоджена — зробіть резервну копію перед продовженням',
  corruptedSettings: 'Файл налаштувань некоректний — застосовано стандартні значення',

  // Parametrized
  searchResults: (n, query) =>
    n === 1 ? `1 результат для «${query}»` : `${n} результатів для «${query}»`,
  snippetCount: (n) => {
    if (n === 1) return '1 сніпет';
    if (n >= 2 && n <= 4) return `${n} сніпети`;
    return `${n} сніпетів`;
  },
  snippetLabel: (title, encrypted) =>
    encrypted ? `${title} (зашифровано)` : title,
};

const de: TranslationMap = {
  // Search
  searchPlaceholder: 'Snippets suchen…',
  noResults: 'Keine Ergebnisse gefunden',
  nothingSelected: 'Snippet auswählen, um eine Vorschau zu sehen',

  // Actions
  copy: 'Kopieren',
  save: 'Speichern',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  quit: 'Beenden',

  // Toasts
  copySuccess: 'Kopiert',
  saveSuccess: 'Gespeichert',
  deleteSuccess: 'Gelöscht',

  // Form labels
  titleLabel: 'Titel',
  contentLabel: 'Inhalt',
  passwordLabel: 'Passwort',
  confirmPasswordLabel: 'Passwort bestätigen',
  encrypted: 'Verschlüsselt',

  of: 'von',

  // Validation
  titleValidation: 'Titel muss 3–50 Zeichen lang sein',
  titleDuplicate: 'Ein Snippet mit diesem Titel existiert bereits',
  contentValidation: 'Inhalt darf nicht leer sein',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  wrongPassword: 'Falsches Passwort',
  decryptError: 'Snippet konnte nicht entschlüsselt werden',
  enterPassword: 'Passwort zum Entschlüsseln eingeben',

  // CRUD headings
  createSnippet: 'Snippet erstellen',
  editSnippet: 'Snippet bearbeiten',
  deleteSnippet: 'Snippet löschen',

  // Empty states
  noSnippets: 'Noch keine Snippets — erstellen Sie das erste!',

  // Settings
  settingsTitle: 'Einstellungen',
  themeLabel: 'Design',
  languageLabel: 'Sprache',
  startInTrayLabel: 'Im Infobereich starten',
  autostartLabel: 'Mit Windows starten',
  confirmOnCloseLabel: 'Vor dem Schließen bestätigen',
  darkTheme: 'Dunkel',
  lightTheme: 'Hell',
  autoLanguage: 'Automatisch (System)',
  restartHint: 'Einige Einstellungen treten nach einem Neustart in Kraft',

  // Exit dialog
  exitConfirmTitle: 'QuickSnippets beenden?',
  exitConfirmMessage: 'Die Anwendung wird geschlossen.',
  cannotUndo: 'Diese Aktion kann nicht rückgängig gemacht werden',

  // Warnings / errors
  hotkeyWarning: 'Globale Tastenkombination konnte nicht registriert werden',
  decrypting: 'Entschlüsseln…',
  corruptedDb: 'Datenbank scheint beschädigt — bitte sichern Sie sie, bevor Sie fortfahren',
  corruptedSettings: 'Einstellungsdatei ist ungültig — Standardwerte wurden angewendet',

  // Parametrized
  searchResults: (n, query) =>
    n === 1 ? `1 Ergebnis für „${query}"` : `${n} Ergebnisse für „${query}"`,
  snippetCount: (n) => (n === 1 ? '1 Snippet' : `${n} Snippets`),
  snippetLabel: (title, encrypted) =>
    encrypted ? `${title} (verschlüsselt)` : title,
};

export const translations: Record<LangCode, TranslationMap> = { en, uk, de };
