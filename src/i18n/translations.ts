import type { LangCode } from '../types';

/** One row of the keyboard shortcuts help (F1). */
export interface HelpShortcut {
  /** The keys as shown, e.g. "Ctrl+N or Insert". */
  keys: string;
  /**
   * The keys as screen readers should read them, when `keys` holds a sign that
   * NVDA skips at its default punctuation level (the comma, the slash).
   */
  spokenKeys?: string;
  action: string;
}

/** The rows of the help, in the groups of the README's Keyboard Shortcuts tables. */
export interface HelpShortcuts {
  global: HelpShortcut[];
  main: HelpShortcut[];
  dialogs: HelpShortcut[];
}

/** Shape of a single locale's translations. */
export interface TranslationMap {
  // ── Search ───────────────────────────────────────────────────────────────
  searchPlaceholder: string;
  noResults: string;
  nothingSelected: string;

  // ── Actions ──────────────────────────────────────────────────────────────
  copy: string;
  autotype: string;
  save: string;
  cancel: string;
  delete: string;
  quit: string;

  // ── Feedback toasts ──────────────────────────────────────────────────────
  copySuccess: string;
  autotypeSuccess: string;
  autotypeError: string;
  autotypeErrorNoEvents: string;
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
  /** Group names in the settings dialog. */
  settingsAppearanceGroup: string;
  settingsStartupGroup: string;
  settingsAutotypeGroup: string;
  themeLabel: string;
  languageLabel: string;
  startInTrayLabel: string;
  autostartLabel: string;
  confirmOnCloseLabel: string;
  autotypeDelayLabel: string;
  /** Hints shown under a setting and read after it by screen readers. */
  autostartHint: string;
  startInTrayHint: string;
  confirmOnCloseHint: string;
  autotypeDelayHint: string;
  darkTheme: string;
  lightTheme: string;
  autoLanguage: string;
  appVersion: (version: string) => string;

  // ── Keyboard shortcuts help (F1) ─────────────────────────────────────────
  helpTitle: string;
  helpGroupGlobal: string;
  helpGroupMain: string;
  helpGroupDialogs: string;
  close: string;
  helpShortcuts: HelpShortcuts;

  // ── Exit / close dialog ──────────────────────────────────────────────────
  exitConfirmTitle: string;
  exitConfirmMessage: string;
  cannotUndo: string;

  // ── Warnings / errors ────────────────────────────────────────────────────
  hotkeyWarning: string;
  decrypting: string;
  corruptedDb: string;
  corruptedSettings: string;

  // ── Sorting ─────────────────────────────────────────────────────────────
  sortCreatedDesc: string;
  sortCreatedAsc: string;
  sortModifiedDesc: string;
  sortModifiedAsc: string;
  sortAlphaAsc: string;
  sortAlphaDesc: string;
  sortLastUsedDesc: string;
  sortLastUsedAsc: string;
  sortToast: (label: string) => string;

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
  autotype: 'Auto-type',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  quit: 'Quit',

  // Toasts
  copySuccess: 'Copied',
  autotypeSuccess: 'Typed',
  autotypeError: 'Auto-type failed',
  autotypeErrorNoEvents: 'Auto-type failed: no events were sent. Target app may require elevation',
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
  settingsAppearanceGroup: 'Appearance and language',
  settingsStartupGroup: 'Startup and closing',
  settingsAutotypeGroup: 'Auto-type',
  themeLabel: 'Theme',
  languageLabel: 'Language',
  startInTrayLabel: 'Start minimized to the tray',
  autostartLabel: 'Start with Windows',
  confirmOnCloseLabel: 'Ask before closing the app',
  autotypeDelayLabel: 'Delay between characters, ms',
  autostartHint: 'Takes effect the next time you sign in to Windows.',
  startInTrayHint: 'Takes effect at the next start. Open the window with Ctrl+Alt+Space.',
  confirmOnCloseHint: "Applies to Alt+F4 and the window's close button.",
  autotypeDelayHint: '0 is the fastest. If characters go missing, try 10–50.',
  darkTheme: 'Dark',
  lightTheme: 'Light',
  autoLanguage: 'Same as Windows',
  appVersion: (v) => `QuickSnippets version ${v}`,

  // Keyboard shortcuts help
  helpTitle: 'Keyboard shortcuts',
  helpGroupGlobal: 'Global (from any application)',
  helpGroupMain: 'Main window',
  helpGroupDialogs: 'Forms and dialogs',
  close: 'Close',
  helpShortcuts: {
    global: [
      { keys: 'Ctrl+Alt+Space', action: 'Show the QuickSnippets window' },
    ],
    main: [
      { keys: 'Arrow Up / Down', action: 'Move the selection in the snippet list' },
      { keys: 'Home / End', action: 'Jump to the first / last snippet' },
      { keys: 'Enter', action: 'Copy the selected snippet to the clipboard' },
      { keys: 'Shift+Enter', action: 'Auto-type the selected snippet into the active application' },
      { keys: 'Ctrl+N or Insert', action: 'Create a new snippet' },
      { keys: 'Ctrl+E', action: 'Edit the selected snippet' },
      { keys: 'Delete or Ctrl+D', action: 'Delete the selected snippet' },
      { keys: 'Ctrl+F or /', spokenKeys: 'Ctrl+F or Slash', action: 'Go to the search box' },
      { keys: 'Ctrl+,', spokenKeys: 'Ctrl+Comma', action: 'Open Settings' },
      { keys: 'Ctrl+Shift+T', action: 'Switch between the light and dark theme' },
      { keys: 'Ctrl+Shift+1', action: 'Sort by creation date; press again to reverse the order' },
      { keys: 'Ctrl+Shift+2', action: 'Sort by modification date; press again to reverse the order' },
      { keys: 'Ctrl+Shift+3', action: 'Sort alphabetically; press again to reverse the order' },
      { keys: 'Ctrl+Shift+4', action: 'Sort by last use; press again to reverse the order' },
      { keys: 'Ctrl+Shift+Space', action: 'Announce the selected snippet (screen reader)' },
      { keys: 'F1', action: 'Show this list of keyboard shortcuts' },
      { keys: 'Escape', action: 'Clear the search; if it is empty, hide the window' },
      { keys: 'Alt+F4', action: 'Quit the application' },
    ],
    dialogs: [
      { keys: 'Ctrl+Enter', action: 'Confirm or save, in every dialog' },
      { keys: 'Escape', action: 'Cancel and close the dialog' },
    ],
  },

  // Exit dialog
  exitConfirmTitle: 'Quit QuickSnippets?',
  exitConfirmMessage: 'The application will close.',
  cannotUndo: 'This action cannot be undone',

  // Warnings / errors
  hotkeyWarning: 'Global hotkey could not be registered',
  decrypting: 'Decrypting…',
  corruptedDb: 'Database appears corrupted — back it up before continuing',
  corruptedSettings: 'Settings file is invalid — defaults have been applied',

  // Sorting
  sortCreatedDesc: 'Newest',
  sortCreatedAsc: 'Oldest',
  sortModifiedDesc: 'Modified ↓',
  sortModifiedAsc: 'Modified ↑',
  sortAlphaAsc: 'A–Z',
  sortAlphaDesc: 'Z–A',
  sortLastUsedDesc: 'Recent',
  sortLastUsedAsc: 'Least used',
  sortToast: (label) => `Sorted: ${label}`,

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
  autotype: 'Автодрук',
  save: 'Зберегти',
  cancel: 'Скасувати',
  delete: 'Видалити',
  quit: 'Вийти',

  // Toasts
  copySuccess: 'Скопійовано',
  autotypeSuccess: 'Надруковано',
  autotypeError: 'Помилка автодруку',
  autotypeErrorNoEvents: 'Помилка автодруку: жодна подія не надіслана. Цільовий застосунок може вимагати прав адміністратора',
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
  settingsAppearanceGroup: 'Вигляд і мова',
  settingsStartupGroup: 'Запуск і закриття',
  settingsAutotypeGroup: 'Автодрук',
  themeLabel: 'Тема',
  languageLabel: 'Мова',
  startInTrayLabel: 'Запускати згорнутим у трей',
  autostartLabel: 'Запускати разом з Windows',
  confirmOnCloseLabel: 'Питати перед закриттям програми',
  autotypeDelayLabel: 'Затримка між символами, мс',
  autostartHint: 'Діє з наступного входу в Windows.',
  startInTrayHint: 'Діє з наступного запуску. Вікно відкривається клавішами Ctrl+Alt+Space.',
  confirmOnCloseHint: 'Стосується Alt+F4 і кнопки закриття вікна.',
  autotypeDelayHint: '0 — найшвидше. Якщо символи губляться, спробуйте 10–50.',
  darkTheme: 'Темна',
  lightTheme: 'Світла',
  autoLanguage: 'Як у Windows',
  appVersion: (v) => `QuickSnippets версія ${v}`,

  // Keyboard shortcuts help
  helpTitle: 'Гарячі клавіші',
  helpGroupGlobal: 'Глобальні (з будь-якої програми)',
  helpGroupMain: 'Головне вікно',
  helpGroupDialogs: 'Форми й діалоги',
  close: 'Закрити',
  helpShortcuts: {
    global: [
      { keys: 'Ctrl+Alt+Space', action: 'Показати вікно QuickSnippets' },
    ],
    main: [
      { keys: 'Стрілка Вгору / Вниз', action: 'Рухатися списком сніпетів' },
      { keys: 'Home / End', action: 'Перейти до першого / останнього сніпета' },
      { keys: 'Enter', action: 'Скопіювати вибраний сніпет у буфер обміну' },
      { keys: 'Shift+Enter', action: 'Надрукувати вибраний сніпет в активній програмі (автодрук)' },
      { keys: 'Ctrl+N або Insert', action: 'Створити новий сніпет' },
      { keys: 'Ctrl+E', action: 'Редагувати вибраний сніпет' },
      { keys: 'Delete або Ctrl+D', action: 'Видалити вибраний сніпет' },
      { keys: 'Ctrl+F або /', spokenKeys: 'Ctrl+F або слеш', action: 'Перейти до поля пошуку' },
      { keys: 'Ctrl+,', spokenKeys: 'Ctrl+кома', action: 'Відкрити налаштування' },
      { keys: 'Ctrl+Shift+T', action: 'Перемкнути світлу й темну тему' },
      { keys: 'Ctrl+Shift+1', action: 'Сортувати за датою створення; повторне натискання змінює напрямок' },
      { keys: 'Ctrl+Shift+2', action: 'Сортувати за датою зміни; повторне натискання змінює напрямок' },
      { keys: 'Ctrl+Shift+3', action: 'Сортувати за алфавітом; повторне натискання змінює напрямок' },
      { keys: 'Ctrl+Shift+4', action: 'Сортувати за часом останнього використання; повторне натискання змінює напрямок' },
      { keys: 'Ctrl+Shift+Space', action: 'Оголосити вибраний сніпет (екранний читач)' },
      { keys: 'F1', action: 'Показати цей список гарячих клавіш' },
      { keys: 'Escape', action: 'Очистити пошук; якщо він порожній, сховати вікно' },
      { keys: 'Alt+F4', action: 'Вийти з програми' },
    ],
    dialogs: [
      { keys: 'Ctrl+Enter', action: 'Підтвердити або зберегти, у будь-якому діалозі' },
      { keys: 'Escape', action: 'Скасувати й закрити діалог' },
    ],
  },

  // Exit dialog
  exitConfirmTitle: 'Вийти з QuickSnippets?',
  exitConfirmMessage: 'Застосунок буде закрито.',
  cannotUndo: 'Цю дію неможливо скасувати',

  // Warnings / errors
  hotkeyWarning: 'Не вдалося зареєструвати глобальне гарячу клавішу',
  decrypting: 'Розшифрування…',
  corruptedDb: 'База даних пошкоджена — зробіть резервну копію перед продовженням',
  corruptedSettings: 'Файл налаштувань некоректний — застосовано стандартні значення',

  // Sorting
  sortCreatedDesc: 'Найновіші',
  sortCreatedAsc: 'Найстаріші',
  sortModifiedDesc: 'Змінені ↓',
  sortModifiedAsc: 'Змінені ↑',
  sortAlphaAsc: 'А–Я',
  sortAlphaDesc: 'Я–А',
  sortLastUsedDesc: 'Нещодавні',
  sortLastUsedAsc: 'Найдавніші',
  sortToast: (label) => `Сортування: ${label}`,

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
  autotype: 'Automatisch tippen',
  save: 'Speichern',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  quit: 'Beenden',

  // Toasts
  copySuccess: 'Kopiert',
  autotypeSuccess: 'Eingegeben',
  autotypeError: 'Automatisches Tippen fehlgeschlagen',
  autotypeErrorNoEvents: 'Automatisches Tippen fehlgeschlagen: Keine Ereignisse gesendet. Zielprogramm erfordert möglicherweise erhöhte Rechte',
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
  settingsAppearanceGroup: 'Darstellung und Sprache',
  settingsStartupGroup: 'Start und Beenden',
  settingsAutotypeGroup: 'Automatisch tippen',
  themeLabel: 'Design',
  languageLabel: 'Sprache',
  startInTrayLabel: 'Minimiert im Infobereich starten',
  autostartLabel: 'Mit Windows starten',
  confirmOnCloseLabel: 'Vor dem Beenden nachfragen',
  autotypeDelayLabel: 'Verzögerung zwischen Zeichen, ms',
  autostartHint: 'Gilt ab der nächsten Anmeldung bei Windows.',
  startInTrayHint: 'Gilt ab dem nächsten Start. Das Fenster öffnet sich mit Strg+Alt+Space.',
  confirmOnCloseHint: 'Gilt für Alt+F4 und die Schließen-Schaltfläche des Fensters.',
  autotypeDelayHint: '0 ist am schnellsten. Wenn Zeichen fehlen, 10–50 versuchen.',
  darkTheme: 'Dunkel',
  lightTheme: 'Hell',
  autoLanguage: 'Wie in Windows',
  appVersion: (v) => `QuickSnippets Version ${v}`,

  // Keyboard shortcuts help
  helpTitle: 'Tastenkürzel',
  helpGroupGlobal: 'Global (aus jeder Anwendung)',
  helpGroupMain: 'Hauptfenster',
  helpGroupDialogs: 'Formulare und Dialoge',
  close: 'Schließen',
  helpShortcuts: {
    global: [
      { keys: 'Strg+Alt+Space', action: 'QuickSnippets-Fenster anzeigen' },
    ],
    main: [
      { keys: 'Pfeil hoch / runter', action: 'Auswahl in der Schnipsel-Liste bewegen' },
      { keys: 'Pos1 / Ende', action: 'Zum ersten / letzten Schnipsel springen' },
      { keys: 'Enter', action: 'Ausgewählten Schnipsel in die Zwischenablage kopieren' },
      { keys: 'Umschalt+Enter', action: 'Ausgewählten Schnipsel automatisch in die aktive Anwendung tippen' },
      { keys: 'Strg+N oder Einfügen', action: 'Neuen Schnipsel erstellen' },
      { keys: 'Strg+E', action: 'Ausgewählten Schnipsel bearbeiten' },
      { keys: 'Entf oder Strg+D', action: 'Ausgewählten Schnipsel löschen' },
      { keys: 'Strg+F oder /', spokenKeys: 'Strg+F oder Schrägstrich', action: 'Zum Suchfeld wechseln' },
      { keys: 'Strg+,', spokenKeys: 'Strg+Komma', action: 'Einstellungen öffnen' },
      { keys: 'Strg+Umschalt+T', action: 'Zwischen hellem und dunklem Design wechseln' },
      { keys: 'Strg+Umschalt+1', action: 'Nach Erstellungsdatum sortieren; erneut drücken kehrt die Richtung um' },
      { keys: 'Strg+Umschalt+2', action: 'Nach Änderungsdatum sortieren; erneut drücken kehrt die Richtung um' },
      { keys: 'Strg+Umschalt+3', action: 'Alphabetisch sortieren; erneut drücken kehrt die Richtung um' },
      { keys: 'Strg+Umschalt+4', action: 'Nach letzter Verwendung sortieren; erneut drücken kehrt die Richtung um' },
      { keys: 'Strg+Umschalt+Space', action: 'Ausgewählten Schnipsel ansagen (Screenreader)' },
      { keys: 'F1', action: 'Diese Liste der Tastenkürzel anzeigen' },
      { keys: 'Esc', action: 'Suche leeren; ist sie leer, Fenster ausblenden' },
      { keys: 'Alt+F4', action: 'Anwendung beenden' },
    ],
    dialogs: [
      { keys: 'Strg+Enter', action: 'Bestätigen oder speichern, in jedem Dialog' },
      { keys: 'Esc', action: 'Abbrechen und Dialog schließen' },
    ],
  },

  // Exit dialog
  exitConfirmTitle: 'QuickSnippets beenden?',
  exitConfirmMessage: 'Die Anwendung wird geschlossen.',
  cannotUndo: 'Diese Aktion kann nicht rückgängig gemacht werden',

  // Warnings / errors
  hotkeyWarning: 'Globale Tastenkombination konnte nicht registriert werden',
  decrypting: 'Entschlüsseln…',
  corruptedDb: 'Datenbank scheint beschädigt — bitte sichern Sie sie, bevor Sie fortfahren',
  corruptedSettings: 'Einstellungsdatei ist ungültig — Standardwerte wurden angewendet',

  // Sorting
  sortCreatedDesc: 'Neueste',
  sortCreatedAsc: 'Älteste',
  sortModifiedDesc: 'Geändert ↓',
  sortModifiedAsc: 'Geändert ↑',
  sortAlphaAsc: 'A–Z',
  sortAlphaDesc: 'Z–A',
  sortLastUsedDesc: 'Zuletzt',
  sortLastUsedAsc: 'Älteste Nutzung',
  sortToast: (label) => `Sortiert: ${label}`,

  // Parametrized
  searchResults: (n, query) =>
    n === 1 ? `1 Ergebnis für „${query}"` : `${n} Ergebnisse für „${query}"`,
  snippetCount: (n) => (n === 1 ? '1 Snippet' : `${n} Snippets`),
  snippetLabel: (title, encrypted) =>
    encrypted ? `${title} (verschlüsselt)` : title,
};

export const translations: Record<LangCode, TranslationMap> = { en, uk, de };
