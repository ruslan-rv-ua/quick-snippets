// Native dialogs shown at start-up, before the web interface exists, when the
// settings or the snippet database cannot be read. src/i18n/translations.ts does
// not reach them, so their texts live here in the three languages of the app.
//
// The buttons are the standard Windows Yes and No: Windows labels them in its
// own display language, so every text ends with what Yes and No will do.

use crate::db::Rescue;
use std::path::Path;

/// Why the snippet database could not be opened, in the terms a user can act on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OpenFailure {
    /// SQLite says the file is not a database or is malformed.
    Damaged,
    /// Another connection holds a lock on the database.
    Busy,
    /// The file or its folder cannot be opened: it may be in use by a program
    /// that does not share it, or the user has no access.
    CannotOpen,
    /// No permission to read or write the file or its folder.
    NoAccess,
    /// The disk is full.
    DiskFull,
    /// The damaged file could not be renamed, so nothing was changed.
    KeepFailed(String),
    /// Anything else, with SQLite's own message.
    Other(String),
}

/// Title and message of one dialog.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DialogText {
    pub title: String,
    pub message: String,
}

/// The language of the start-up dialogs: the language from the settings when
/// it is one the app has, otherwise the Windows display language (which itself
/// falls back to English).
pub fn dialog_language(settings_language: &str) -> String {
    match settings_language {
        "en" | "uk" | "de" => settings_language.to_string(),
        _ => crate::settings::detect_language(),
    }
}

fn title(lang: &str) -> String {
    match lang {
        "uk" => "QuickSnippets — Помилка",
        "de" => "QuickSnippets — Fehler",
        _ => "QuickSnippets — Error",
    }
    .to_string()
}

/// settings.json exists but cannot be read. Yes resets the settings, No quits.
pub fn settings_unreadable(lang: &str) -> DialogText {
    let message = match lang {
        "uk" => "Не вдається прочитати файл налаштувань settings.json.\n\n\
                 Скинути налаштування до стандартних?\n\n\
                 Так: файл буде замінено стандартними налаштуваннями. Сніпетів це не стосується.\n\
                 Ні: QuickSnippets закриється і нічого не змінить."
            .to_string(),
        "de" => "Die Einstellungsdatei settings.json kann nicht gelesen werden.\n\n\
                 Einstellungen auf die Standardwerte zurücksetzen?\n\n\
                 Ja: Die Datei wird durch die Standardeinstellungen ersetzt. Ihre Snippets bleiben unverändert.\n\
                 Nein: QuickSnippets wird beendet und ändert nichts."
            .to_string(),
        _ => "The settings file settings.json cannot be read.\n\n\
              Reset the settings to the defaults?\n\n\
              Yes: the file is replaced with the default settings. Your snippets are not affected.\n\
              No: QuickSnippets closes and changes nothing."
            .to_string(),
    };
    DialogText { title: title(lang), message }
}

/// snippets.db is damaged. Yes renames it to `kept_name` in `folder` and starts
/// with an empty database, No quits.
pub fn db_damaged(lang: &str, kept_name: &str, folder: &Path) -> DialogText {
    let folder = folder.display();
    let message = match lang {
        "uk" => format!(
            "База сніпетів snippets.db пошкоджена, її не вдається відкрити.\n\n\
             Зберегти пошкоджений файл і почати з порожньою базою?\n\n\
             Так: пошкоджений файл отримає назву {kept_name} і залишиться в теці {folder}. \
             QuickSnippets почне роботу з порожнім списком сніпетів.\n\
             Ні: QuickSnippets закриється і нічого не змінить."
        ),
        "de" => format!(
            "Die Snippet-Datenbank snippets.db ist beschädigt und kann nicht geöffnet werden.\n\n\
             Die beschädigte Datei behalten und mit einer leeren Datenbank beginnen?\n\n\
             Ja: Die beschädigte Datei wird in {kept_name} umbenannt und bleibt im Ordner {folder}. \
             QuickSnippets startet mit einer leeren Snippet-Liste.\n\
             Nein: QuickSnippets wird beendet und ändert nichts."
        ),
        _ => format!(
            "The snippet database snippets.db is damaged and cannot be opened.\n\n\
             Keep the damaged file and start with an empty database?\n\n\
             Yes: the damaged file is renamed to {kept_name} and stays in the folder {folder}. \
             QuickSnippets starts with an empty list of snippets.\n\
             No: QuickSnippets closes and changes nothing."
        ),
    };
    DialogText { title: title(lang), message }
}

fn failure_reason(lang: &str, failure: &OpenFailure) -> String {
    match (lang, failure) {
        ("uk", OpenFailure::Damaged) => "Файл пошкоджений.".to_string(),
        ("uk", OpenFailure::Busy) => {
            "Базу зараз використовує інша програма. Закрийте її і спробуйте ще раз.".to_string()
        }
        ("uk", OpenFailure::CannotOpen) => "Файл може використовувати інша програма, \
             або QuickSnippets не має доступу до файлу чи його теки."
            .to_string(),
        ("uk", OpenFailure::NoAccess) => {
            "QuickSnippets не має доступу до файлу або до його теки.".to_string()
        }
        ("uk", OpenFailure::DiskFull) => {
            "Диск заповнений. Звільніть місце і спробуйте ще раз.".to_string()
        }
        ("uk", OpenFailure::KeepFailed(e)) => format!(
            "Не вдалося перейменувати пошкоджений файл, тому нічого не змінено. Подробиці: {e}"
        ),
        ("uk", OpenFailure::Other(e)) => format!("Подробиці: {e}"),

        ("de", OpenFailure::Damaged) => "Die Datei ist beschädigt.".to_string(),
        ("de", OpenFailure::Busy) => "Ein anderes Programm verwendet die Datenbank gerade. \
             Schließen Sie es und versuchen Sie es erneut."
            .to_string(),
        ("de", OpenFailure::CannotOpen) => "Möglicherweise verwendet ein anderes Programm die Datei, \
             oder QuickSnippets hat keinen Zugriff auf die Datei oder ihren Ordner."
            .to_string(),
        ("de", OpenFailure::NoAccess) => {
            "QuickSnippets hat keinen Zugriff auf die Datei oder ihren Ordner.".to_string()
        }
        ("de", OpenFailure::DiskFull) => {
            "Der Datenträger ist voll. Geben Sie Speicherplatz frei und versuchen Sie es erneut."
                .to_string()
        }
        ("de", OpenFailure::KeepFailed(e)) => format!(
            "Die beschädigte Datei konnte nicht umbenannt werden, daher wurde nichts geändert. \
             Einzelheiten: {e}"
        ),
        ("de", OpenFailure::Other(e)) => format!("Einzelheiten: {e}"),

        (_, OpenFailure::Damaged) => "The file is damaged.".to_string(),
        (_, OpenFailure::Busy) => {
            "Another program is using the database right now. Close it, then try again."
                .to_string()
        }
        (_, OpenFailure::CannotOpen) => "Another program may be using the file, \
             or QuickSnippets has no access to the file or its folder."
            .to_string(),
        (_, OpenFailure::NoAccess) => {
            "QuickSnippets has no access to the file or its folder.".to_string()
        }
        (_, OpenFailure::DiskFull) => "The disk is full. Free some space, then try again.".to_string(),
        (_, OpenFailure::KeepFailed(e)) => format!(
            "The damaged file could not be renamed, so nothing was changed. Details: {e}"
        ),
        (_, OpenFailure::Other(e)) => format!("Details: {e}"),
    }
}

/// snippets.db cannot be opened for a reason other than damage (or the damaged
/// file could not be kept). Yes tries again, No quits.
pub fn db_cannot_open(lang: &str, failure: &OpenFailure, folder: &Path) -> DialogText {
    let folder = folder.display();
    let reason = failure_reason(lang, failure);
    let message = match lang {
        "uk" => format!(
            "Не вдається відкрити базу сніпетів snippets.db у теці {folder}.\n\n\
             {reason}\n\n\
             Спробувати ще раз?\n\n\
             Так: QuickSnippets спробує ще раз.\n\
             Ні: QuickSnippets закриється і нічого не змінить."
        ),
        "de" => format!(
            "Die Snippet-Datenbank snippets.db im Ordner {folder} kann nicht geöffnet werden.\n\n\
             {reason}\n\n\
             Erneut versuchen?\n\n\
             Ja: QuickSnippets versucht es erneut.\n\
             Nein: QuickSnippets wird beendet und ändert nichts."
        ),
        _ => format!(
            "The snippet database snippets.db in the folder {folder} cannot be opened.\n\n\
             {reason}\n\n\
             Try again?\n\n\
             Yes: QuickSnippets tries again.\n\
             No: QuickSnippets closes and changes nothing."
        ),
    };
    DialogText { title: title(lang), message }
}

/// Why the snippets that can still be read were not moved into a new database. Nothing was
/// changed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RescueFailure {
    /// They could not be copied into the new database (for example the disk is full).
    CopyFailed(String),
    /// The damaged file could not be renamed (for example another program holds it).
    KeepFailed(String),
}

/// Most titles of unreadable snippets a dialog names; the others are only counted.
pub const MAX_LOST_TITLES: usize = 10;

/// "N of them: «A», «B» and 3 more", in the quotes of the language; empty when no title is
/// known.
fn lost_titles_text(lang: &str, rescue: &Rescue) -> String {
    if rescue.lost_titles.is_empty() {
        return String::new();
    }
    let (open, close) = match lang {
        "uk" => ("«", "»"),
        "de" => ("„", "“"),
        _ => ("\u{201C}", "\u{201D}"),
    };
    let shown: Vec<String> = rescue
        .lost_titles
        .iter()
        .take(MAX_LOST_TITLES)
        .map(|t| format!("{open}{t}{close}"))
        .collect();
    let more = rescue.lost() - shown.len();
    let mut text = format!(": {}", shown.join(", "));
    if more > 0 {
        text.push_str(&match lang {
            "uk" => format!(" і ще {more}"),
            "de" => format!(" und {more} weitere"),
            _ => format!(" and {more} more"),
        });
    }
    text
}

/// snippets.db opened, but the quick check at start-up found it damaged inside. Yes moves the
/// snippets that can be read into a new database and renames the damaged file to `kept_name`
/// in `folder`; No keeps working with the damaged file.
pub fn db_damaged_inside(lang: &str, rescue: &Rescue, kept_name: &str, folder: &Path) -> DialogText {
    let folder = folder.display();
    let (total, saved, lost) = (rescue.total(), rescue.saved, rescue.lost());
    let names = lost_titles_text(lang, rescue);
    let message = match lang {
        "uk" => {
            let counts = if total == 0 {
                "Сніпетів у ній не вдається знайти.".to_string()
            } else if lost == 0 {
                format!("Сніпетів у базі: {total}. Усі вдається прочитати.")
            } else {
                format!(
                    "Сніпетів у базі: {total}. Вдається прочитати: {saved}. \
                     Не вдається прочитати: {lost}{names}."
                )
            };
            let yes = if saved == 0 {
                "Так: QuickSnippets почне роботу з порожньою базою.".to_string()
            } else {
                format!("Так: нова база snippets.db міститиме сніпети, які вдається прочитати ({saved}).")
            };
            format!(
                "База сніпетів snippets.db пошкоджена.\n\n\
                 {counts}\n\n\
                 Перенести сніпети, які вдається прочитати, у нову базу?\n\n\
                 {yes} Пошкоджений файл отримає назву {kept_name} і залишиться в теці {folder} без змін.\n\
                 Ні: QuickSnippets працюватиме з пошкодженою базою як є: деяких сніпетів може не бути \
                 в списку, а зберегти зміни може не вдатися. Під час наступного запуску програма запитає знову."
            )
        }
        "de" => {
            let counts = if total == 0 {
                "Darin lassen sich keine Snippets finden.".to_string()
            } else if lost == 0 {
                format!("Snippets in der Datenbank: {total}. Alle lassen sich lesen.")
            } else {
                format!(
                    "Snippets in der Datenbank: {total}. Lesbar: {saved}. Nicht lesbar: {lost}{names}."
                )
            };
            let yes = if saved == 0 {
                "Ja: QuickSnippets startet mit einer leeren Datenbank.".to_string()
            } else {
                format!("Ja: Die neue snippets.db enthält die lesbaren Snippets ({saved}).")
            };
            format!(
                "Die Snippet-Datenbank snippets.db ist beschädigt.\n\n\
                 {counts}\n\n\
                 Die lesbaren Snippets in eine neue Datenbank übernehmen?\n\n\
                 {yes} Die beschädigte Datei wird in {kept_name} umbenannt und bleibt unverändert im \
                 Ordner {folder}.\n\
                 Nein: QuickSnippets arbeitet mit der beschädigten Datenbank weiter, wie sie ist: Einige \
                 Snippets fehlen womöglich in der Liste, und Speichern kann fehlschlagen. Beim nächsten \
                 Start fragt QuickSnippets erneut."
            )
        }
        _ => {
            let counts = if total == 0 {
                "No snippets can be found in it.".to_string()
            } else if lost == 0 {
                format!("Snippets in the database: {total}. All of them can be read.")
            } else {
                format!(
                    "Snippets in the database: {total}. Can be read: {saved}. \
                     Cannot be read: {lost}{names}."
                )
            };
            let yes = if saved == 0 {
                "Yes: QuickSnippets starts with an empty database.".to_string()
            } else {
                format!("Yes: the new snippets.db holds the snippets that can be read ({saved}).")
            };
            format!(
                "The snippet database snippets.db is damaged.\n\n\
                 {counts}\n\n\
                 Move the snippets that can be read into a new database?\n\n\
                 {yes} The damaged file is renamed to {kept_name} and stays in the folder {folder}, \
                 unchanged.\n\
                 No: QuickSnippets works with the damaged database as it is: some snippets may be \
                 missing from the list, and saving may fail. QuickSnippets asks again at the next start."
            )
        }
    };
    DialogText { title: title(lang), message }
}

/// The rescue of a damaged snippets.db failed and changed nothing. Yes tries again, No keeps
/// working with the damaged file.
pub fn db_rescue_failed(lang: &str, failure: &RescueFailure, folder: &Path) -> DialogText {
    let folder = folder.display();
    let message = match lang {
        "uk" => {
            let (what, e) = match failure {
                RescueFailure::CopyFailed(e) => {
                    ("сніпети, які вдається прочитати, не вдалося перенести в нову базу", e)
                }
                RescueFailure::KeepFailed(e) => ("пошкоджений файл не вдалося перейменувати", e),
            };
            format!(
                "База сніпетів snippets.db у теці {folder} пошкоджена, і {what}. Нічого не змінено.\n\n\
                 Подробиці: {e}\n\n\
                 Спробувати ще раз?\n\n\
                 Так: QuickSnippets спробує ще раз.\n\
                 Ні: QuickSnippets працюватиме з пошкодженою базою як є: деяких сніпетів може не бути \
                 в списку, а зберегти зміни може не вдатися."
            )
        }
        "de" => {
            let (what, e) = match failure {
                RescueFailure::CopyFailed(e) => {
                    ("die lesbaren Snippets ließen sich nicht in eine neue Datenbank übernehmen", e)
                }
                RescueFailure::KeepFailed(e) => ("die beschädigte Datei ließ sich nicht umbenennen", e),
            };
            format!(
                "Die Snippet-Datenbank snippets.db im Ordner {folder} ist beschädigt, und {what}. \
                 Es wurde nichts geändert.\n\n\
                 Einzelheiten: {e}\n\n\
                 Erneut versuchen?\n\n\
                 Ja: QuickSnippets versucht es erneut.\n\
                 Nein: QuickSnippets arbeitet mit der beschädigten Datenbank weiter, wie sie ist: Einige \
                 Snippets fehlen womöglich in der Liste, und Speichern kann fehlschlagen."
            )
        }
        _ => {
            let (what, e) = match failure {
                RescueFailure::CopyFailed(e) => {
                    ("the snippets that can be read could not be copied into a new database", e)
                }
                RescueFailure::KeepFailed(e) => ("the damaged file could not be renamed", e),
            };
            format!(
                "The snippet database snippets.db in the folder {folder} is damaged, and {what}. \
                 Nothing was changed.\n\n\
                 Details: {e}\n\n\
                 Try again?\n\n\
                 Yes: QuickSnippets tries again.\n\
                 No: QuickSnippets works with the damaged database as it is: some snippets may be \
                 missing from the list, and saving may fail."
            )
        }
    };
    DialogText { title: title(lang), message }
}

/// Show `text` as a native warning with the standard Yes and No buttons.
/// Returns true for Yes.
#[cfg(not(test))]
pub fn ask_yes_no(text: &DialogText) -> bool {
    rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Warning)
        .set_title(&text.title)
        .set_description(&text.message)
        .set_buttons(rfd::MessageButtons::YesNo)
        .show()
        == rfd::MessageDialogResult::Yes
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const LANGS: [&str; 3] = ["en", "uk", "de"];

    fn folder() -> PathBuf {
        PathBuf::from(r"C:\Apps\QuickSnippets\quick-snippets-data")
    }

    fn all_failures() -> Vec<OpenFailure> {
        vec![
            OpenFailure::Damaged,
            OpenFailure::Busy,
            OpenFailure::CannotOpen,
            OpenFailure::NoAccess,
            OpenFailure::DiskFull,
            OpenFailure::KeepFailed("access denied".to_string()),
            OpenFailure::Other("disk I/O error".to_string()),
        ]
    }

    // --- dialog_language ---

    #[test]
    fn test_dialog_language_uses_the_settings_language() {
        assert_eq!(dialog_language("en"), "en");
        assert_eq!(dialog_language("uk"), "uk");
        assert_eq!(dialog_language("de"), "de");
    }

    #[test]
    fn test_dialog_language_same_as_windows_uses_the_windows_language() {
        // An empty language setting means "same as Windows".
        assert_eq!(dialog_language(""), crate::settings::detect_language());
    }

    #[test]
    fn test_dialog_language_unknown_setting_uses_the_windows_language() {
        assert_eq!(dialog_language("fr"), crate::settings::detect_language());
        assert_eq!(dialog_language("garbage"), crate::settings::detect_language());
    }

    #[test]
    fn test_unknown_language_texts_are_english() {
        assert_eq!(settings_unreadable("fr"), settings_unreadable("en"));
        assert_eq!(
            db_damaged("", "x.db", &folder()),
            db_damaged("en", "x.db", &folder())
        );
        assert_eq!(
            db_cannot_open("pl", &OpenFailure::Busy, &folder()),
            db_cannot_open("en", &OpenFailure::Busy, &folder())
        );
    }

    // --- titles ---

    #[test]
    fn test_titles_are_translated() {
        assert_eq!(settings_unreadable("en").title, "QuickSnippets — Error");
        assert_eq!(settings_unreadable("uk").title, "QuickSnippets — Помилка");
        assert_eq!(settings_unreadable("de").title, "QuickSnippets — Fehler");
    }

    // --- settings dialog ---

    #[test]
    fn test_settings_dialog_in_three_languages() {
        let en = settings_unreadable("en").message;
        assert!(en.contains("settings.json cannot be read"));
        assert!(en.contains("Reset the settings to the defaults?"));
        assert!(en.contains("Yes: ") && en.contains("No: QuickSnippets closes and changes nothing."));

        let uk = settings_unreadable("uk").message;
        assert!(uk.contains("Не вдається прочитати файл налаштувань settings.json"));
        assert!(uk.contains("Скинути налаштування до стандартних?"));
        assert!(uk.contains("Так: ") && uk.contains("Ні: QuickSnippets закриється і нічого не змінить."));

        let de = settings_unreadable("de").message;
        assert!(de.contains("settings.json kann nicht gelesen werden"));
        assert!(de.contains("Einstellungen auf die Standardwerte zurücksetzen?"));
        assert!(de.contains("Ja: ") && de.contains("Nein: QuickSnippets wird beendet und ändert nichts."));
    }

    // --- damaged database dialog ---

    #[test]
    fn test_db_damaged_dialog_names_the_kept_file_and_folder_in_three_languages() {
        let name = "snippets-damaged-2026-11-20-14-35.db";
        for lang in LANGS {
            let text = db_damaged(lang, name, &folder());
            assert!(text.message.contains(name), "{lang}: kept file name missing");
            assert!(
                text.message.contains(r"C:\Apps\QuickSnippets\quick-snippets-data"),
                "{lang}: folder missing"
            );
            assert!(text.message.contains("snippets.db"), "{lang}");
        }
        assert!(db_damaged("en", name, &folder())
            .message
            .contains("Keep the damaged file and start with an empty database?"));
        assert!(db_damaged("uk", name, &folder())
            .message
            .contains("Зберегти пошкоджений файл і почати з порожньою базою?"));
        assert!(db_damaged("de", name, &folder())
            .message
            .contains("Die beschädigte Datei behalten und mit einer leeren Datenbank beginnen?"));
    }

    #[test]
    fn test_db_damaged_dialog_no_longer_says_snippets_are_lost() {
        for lang in LANGS {
            let text = db_damaged(lang, "x.db", &folder()).message.to_lowercase();
            assert!(!text.contains("lost") && !text.contains("permanently"), "{lang}");
            assert!(!text.contains("втрачено") && !text.contains("назавжди"), "{lang}");
            assert!(!text.contains("verloren") && !text.contains("endgültig"), "{lang}");
        }
    }

    // --- cannot open dialog ---

    #[test]
    fn test_db_cannot_open_dialog_asks_to_try_again_in_three_languages() {
        let en = db_cannot_open("en", &OpenFailure::Busy, &folder()).message;
        assert!(en.contains("Try again?"));
        assert!(en.contains("Another program is using the database"));
        let uk = db_cannot_open("uk", &OpenFailure::Busy, &folder()).message;
        assert!(uk.contains("Спробувати ще раз?"));
        assert!(uk.contains("Базу зараз використовує інша програма"));
        let de = db_cannot_open("de", &OpenFailure::Busy, &folder()).message;
        assert!(de.contains("Erneut versuchen?"));
        assert!(de.contains("Ein anderes Programm verwendet die Datenbank"));
    }

    #[test]
    fn test_every_failure_has_its_own_reason_in_every_language() {
        for lang in LANGS {
            let reasons: Vec<String> = all_failures()
                .iter()
                .map(|f| failure_reason(lang, f))
                .collect();
            for (i, a) in reasons.iter().enumerate() {
                assert!(!a.is_empty(), "{lang}: empty reason");
                for b in reasons.iter().skip(i + 1) {
                    assert_ne!(a, b, "{lang}: two failures share a reason");
                }
            }
        }
    }

    #[test]
    fn test_reasons_differ_between_languages() {
        for failure in all_failures() {
            let en = failure_reason("en", &failure);
            let uk = failure_reason("uk", &failure);
            let de = failure_reason("de", &failure);
            assert_ne!(en, uk, "{failure:?}");
            assert_ne!(en, de, "{failure:?}");
            assert_ne!(uk, de, "{failure:?}");
        }
    }

    #[test]
    fn test_details_are_passed_through() {
        for lang in LANGS {
            let keep = db_cannot_open(lang, &OpenFailure::KeepFailed("os error 32".into()), &folder());
            assert!(keep.message.contains("os error 32"), "{lang}");
            let other = db_cannot_open(lang, &OpenFailure::Other("disk I/O error".into()), &folder());
            assert!(other.message.contains("disk I/O error"), "{lang}");
            assert!(other.message.contains(r"quick-snippets-data"), "{lang}: folder missing");
        }
    }

    // --- damage inside a database that opens (TASK-33) ---

    const KEPT: &str = "snippets-damaged-2026-11-21-03-10.db";

    fn rescue(saved: usize, lost: &[&str], untitled: usize) -> Rescue {
        Rescue {
            saved,
            lost_titles: lost.iter().map(|t| t.to_string()).collect(),
            lost_untitled: untitled,
        }
    }

    #[test]
    fn test_damaged_inside_dialog_gives_counts_titles_file_and_folder_in_three_languages() {
        let r = rescue(85, &["Сніпет 049 тест", "Пароль до пошти"], 0);
        let en = db_damaged_inside("en", &r, KEPT, &folder()).message;
        assert!(en.contains("The snippet database snippets.db is damaged."));
        assert!(en.contains("Snippets in the database: 87. Can be read: 85. Cannot be read: 2: \u{201C}Сніпет 049 тест\u{201D}, \u{201C}Пароль до пошти\u{201D}."));
        assert!(en.contains("Move the snippets that can be read into a new database?"));
        assert!(en.contains("Yes: the new snippets.db holds the snippets that can be read (85)."));
        assert!(en.contains("No: QuickSnippets works with the damaged database as it is"));

        let uk = db_damaged_inside("uk", &r, KEPT, &folder()).message;
        assert!(uk.contains("База сніпетів snippets.db пошкоджена."));
        assert!(uk.contains("Сніпетів у базі: 87. Вдається прочитати: 85. Не вдається прочитати: 2: «Сніпет 049 тест», «Пароль до пошти»."));
        assert!(uk.contains("Перенести сніпети, які вдається прочитати, у нову базу?"));
        assert!(uk.contains("Так: нова база snippets.db міститиме сніпети, які вдається прочитати (85)."));
        assert!(uk.contains("Ні: QuickSnippets працюватиме з пошкодженою базою як є"));
        assert!(uk.contains("Під час наступного запуску програма запитає знову."));

        let de = db_damaged_inside("de", &r, KEPT, &folder()).message;
        assert!(de.contains("Die Snippet-Datenbank snippets.db ist beschädigt."));
        assert!(de.contains("Snippets in der Datenbank: 87. Lesbar: 85. Nicht lesbar: 2: „Сніпет 049 тест“, „Пароль до пошти“."));
        assert!(de.contains("Die lesbaren Snippets in eine neue Datenbank übernehmen?"));
        assert!(de.contains("Nein: QuickSnippets arbeitet mit der beschädigten Datenbank weiter"));

        for lang in LANGS {
            let text = db_damaged_inside(lang, &r, KEPT, &folder());
            assert!(text.message.contains(KEPT), "{lang}: kept file name missing");
            assert!(text.message.contains(r"C:\Apps\QuickSnippets\quick-snippets-data"), "{lang}: folder missing");
            assert_eq!(text.title, db_damaged(lang, KEPT, &folder()).title, "{lang}");
        }
        assert_eq!(
            db_damaged_inside("fr", &r, KEPT, &folder()),
            db_damaged_inside("en", &r, KEPT, &folder())
        );
    }

    #[test]
    fn test_damaged_inside_dialog_names_at_most_ten_titles() {
        let titles: Vec<String> = (1..=13).map(|i| format!("Title {i:02}")).collect();
        let refs: Vec<&str> = titles.iter().map(String::as_str).collect();
        let r = rescue(5, &refs, 2);
        let en = db_damaged_inside("en", &r, KEPT, &folder()).message;
        assert!(en.contains("Cannot be read: 15: "), "{en}");
        assert!(en.contains("\u{201C}Title 10\u{201D} and 5 more."), "{en}");
        assert!(!en.contains("Title 11"));
        assert!(db_damaged_inside("uk", &r, KEPT, &folder()).message.contains("»\u{0020}і ще 5."));
        assert!(db_damaged_inside("de", &r, KEPT, &folder()).message.contains("“ und 5 weitere."));
    }

    #[test]
    fn test_damaged_inside_dialog_without_known_titles_only_counts() {
        let r = rescue(10, &[], 3);
        assert!(db_damaged_inside("en", &r, KEPT, &folder())
            .message
            .contains("Snippets in the database: 13. Can be read: 10. Cannot be read: 3.\n"));
        assert!(db_damaged_inside("uk", &r, KEPT, &folder())
            .message
            .contains("Не вдається прочитати: 3.\n"));
    }

    /// Damage only in the parts that help SQLite find the snippets: nothing is lost.
    #[test]
    fn test_damaged_inside_dialog_when_every_snippet_can_be_read() {
        let r = rescue(93, &[], 0);
        assert!(db_damaged_inside("en", &r, KEPT, &folder())
            .message
            .contains("Snippets in the database: 93. All of them can be read."));
        assert!(db_damaged_inside("uk", &r, KEPT, &folder())
            .message
            .contains("Сніпетів у базі: 93. Усі вдається прочитати."));
        assert!(db_damaged_inside("de", &r, KEPT, &folder())
            .message
            .contains("Snippets in der Datenbank: 93. Alle lassen sich lesen."));
    }

    #[test]
    fn test_damaged_inside_dialog_when_nothing_can_be_read_starts_empty() {
        let r = rescue(0, &["A title"], 0);
        assert!(db_damaged_inside("en", &r, KEPT, &folder())
            .message
            .contains("Yes: QuickSnippets starts with an empty database."));
        assert!(db_damaged_inside("uk", &r, KEPT, &folder())
            .message
            .contains("Так: QuickSnippets почне роботу з порожньою базою."));
        assert!(db_damaged_inside("de", &r, KEPT, &folder())
            .message
            .contains("Ja: QuickSnippets startet mit einer leeren Datenbank."));
        assert!(db_damaged_inside("en", &rescue(0, &[], 0), KEPT, &folder())
            .message
            .contains("No snippets can be found in it."));
    }

    #[test]
    fn test_rescue_failed_dialog_says_what_failed_and_asks_to_try_again() {
        let copy = RescueFailure::CopyFailed("database or disk is full".into());
        let keep = RescueFailure::KeepFailed("os error 32".into());
        let en = db_rescue_failed("en", &copy, &folder()).message;
        assert!(en.contains("could not be copied into a new database. Nothing was changed."));
        assert!(en.contains("Details: database or disk is full"));
        assert!(en.contains("Try again?") && en.contains("No: QuickSnippets works with the damaged database"));
        let uk = db_rescue_failed("uk", &keep, &folder()).message;
        assert!(uk.contains("пошкоджений файл не вдалося перейменувати. Нічого не змінено."));
        assert!(uk.contains("Подробиці: os error 32") && uk.contains("Спробувати ще раз?"));
        let de = db_rescue_failed("de", &copy, &folder()).message;
        assert!(de.contains("Es wurde nichts geändert.") && de.contains("Erneut versuchen?"));
        for lang in LANGS {
            for failure in [&copy, &keep] {
                let text = db_rescue_failed(lang, failure, &folder()).message;
                assert!(text.contains(r"quick-snippets-data"), "{lang}: folder missing");
            }
            assert_ne!(
                db_rescue_failed(lang, &copy, &folder()),
                db_rescue_failed(lang, &keep, &folder()),
                "{lang}"
            );
        }
    }
}
