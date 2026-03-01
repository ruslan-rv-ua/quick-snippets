<div align="center">
	<img src="logo-readme.png" alt="QuickSnippets-Logo" />
	<h1>QuickSnippets</h1>
	<p><strong>Ein portabler Windows-Launcher für Ihre Textschnipsel — immer nur einen Tastendruck entfernt.</strong></p>
	<p>
		<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="Lizenz: MIT"></a>
		<a href="https://github.com/ruslan-rv-ua/quick-snippets/releases"><img src="https://img.shields.io/badge/Platform-Windows-0078D4.svg" alt="Plattform: Windows"></a>
	</p>
	<p>
		🌐 <strong>Dieses Dokument lesen:</strong>
		<a href="README.md">English</a> ·
		<a href="README.uk.md">Українська</a> ·
		<a href="README.de.md">Deutsch</a>
	</p>
</div>

---

## Was ist QuickSnippets?

QuickSnippets ist eine kleine, portable Desktop-Anwendung, mit der Sie eine persönliche Bibliothek von Textschnipseln verwalten und jeden davon innerhalb von Sekunden in jede Anwendung einfügen können.

Drücken Sie **Ctrl+Alt+Space** von überall auf Ihrem Desktop. Das Fenster erscheint, Sie tippen ein paar Buchstaben, um das gewünschte Snippet zu finden, drücken **Enter** — und es befindet sich in Ihrer Zwischenablage. Keine Cloud, keine Telemetrie, keine Installation erforderlich.

Sensible Snippets können lokal mit AES-256-GCM verschlüsselt werden, sodass nur Sie — mit dem richtigen Passwort — darauf zugreifen können.

---

## Funktionen

- **Sofortiger Zugriff** — globaler Hotkey zeigt das Fenster aus jeder Anwendung heraus
- **Schnelle Suche** — Fuzzy-Suche filtert Snippets während der Eingabe
- **Verschlüsselte Snippets** — schützen Sie sensible Inhalte mit einem Passwort (AES-256-GCM-Verschlüsselung, Schlüssel verlassen niemals das Gerät)
- **Vollständig tastaturgesteuert** — jede Aktion hat eine Tastenkombination; die Maus ist optional
- **Screenreader-Unterstützung** — von Anfang an für NVDA, JAWS und Windows Narrator konzipiert
- **Portabel** — kein Installer, keine Registry, kein `AppData`; die gesamte App lebt in einem Ordner
- **Systemtray** — bleibt unauffällig, wenn nicht in Verwendung; Rechtsklick auf das Tray-Symbol für schnelle Aktionen
- **Helles und dunkles Design** — mit einer Tastenkombination oder über die Einstellungen wechseln
- **Drei Sprachen** — Englisch, Ukrainisch und Deutsch; Sprache wird automatisch aus dem System erkannt
- **Einzelinstanz** — erneutes Starten der App bringt das vorhandene Fenster einfach in den Vordergrund
- **Automatisches Ausblenden bei Fokusverlust** — das Fenster verschwindet beim Wechsel, wie ein Launcher

---

## Barrierefreiheit

QuickSnippets wurde mit Barrierefreiheit als höchster Priorität entwickelt. Jede Funktion ist so gestaltet, dass sie ohne Maus funktioniert und von Hilfstechnologien korrekt ausgegeben wird.

- Alle interaktiven Elemente haben beschreibende ARIA-Labels und -Rollen
- Die Snippet-Liste ist eine korrekte `listbox` mit `aria-activedescendant`; Screenreader geben das ausgewählte Snippet und seine Position aus (z.B. „Begrüßung, 1 von 12")
- Der Fokus wird in modalen Dialogen eingeschlossen und nach dem Schließen zum auslösenden Element zurückgeführt
- Live-Regions geben Kopierbestätigungen und Fehlermeldungen aus, ohne den Fokus zu verschieben
- Der WebView2-Barrierefreiheitsbaum wird beim Start zwangsinitialisiert, sodass Screenreader korrekt funktionieren, auch wenn die App minimiert im Tray startet
- `Ctrl+Shift+Space` liest das aktuell ausgewählte Snippet über eine höfliche Live-Region vor
- Hoher Kontrast und Änderungen des Systemdesigns werden berücksichtigt
- Formulareingaben deaktivieren die Browser-Autovervollständigung, um Verwirrung bei Hilfstechnologien zu vermeiden

---

## Sicherheit

- **Nur lokale Verschlüsselung.** Verschlüsselte Snippets werden als AES-256-GCM-Chiffretext in einer lokalen SQLite-Datenbank gespeichert. Der entschlüsselte Inhalt wird niemals an den Frontend-Prozess gesendet.
- **Starke Schlüsselableitung.** Verschlüsselungsschlüssel werden aus Ihrem Passwort mit PBKDF2-HMAC-SHA256 mit 100.000 Iterationen, einem einzigartigen zufälligen Salt und einem einzigartigen zufälligen Nonce pro Verschlüsselung abgeleitet.
- **Zwischenablagen-Operationen in Rust.** Wenn Sie ein verschlüsseltes Snippet aktivieren, entschlüsselt das Rust-Backend es und schreibt direkt in die Zwischenablage. Der Klartext überquert niemals die IPC-Grenze.
- **Kein Netzwerkzugriff.** Die Anwendung stellt keine ausgehenden Verbindungen her.

---

## Installation

QuickSnippets ist eine portable Anwendung — kein Installer erforderlich.

1. Gehen Sie zur [Releases-Seite](https://github.com/ruslan-rv-ua/quick-snippets/releases).
2. Laden Sie das neueste `quick-snippets-windows-x64-vX.Y.Z.zip` herunter.
3. Entpacken Sie die ZIP in einen beliebigen Ordner (z.B. `C:\Tools\QuickSnippets\`).
4. Führen Sie `quick-snippets.exe` aus.

### Installation über Scoop

Wenn Sie [Scoop](https://scoop.sh/) verwenden, können Sie QuickSnippets aus dem offiziellen Bucket installieren:

```powershell
scoop bucket add ruslan-rv-ua https://github.com/ruslan-rv-ua/scoop-bucket
scoop install quick-snippets
```

Ihre Snippets-Datenbank (`snippets.db`) und Einstellungen (`settings.json`) werden im selben Ordner wie die ausführbare Datei gespeichert. Um die App zu verschieben oder zu sichern, kopieren Sie den gesamten Ordner.

> **SHA-256-Prüfsumme** — eine `.sha256`-Datei ist jedem Release zur Überprüfung beigefügt.

---

## Erste Schritte

### Erster Start

Beim ersten Start ist die Snippet-Liste leer. Drücken Sie **Ctrl+N** (oder **Insert**), um Ihr erstes Snippet zu erstellen.

Geben Sie einen kurzen, einprägsamen Titel — danach wird gesucht. Fügen Sie den Inhalt ein oder tippen Sie ihn ein. Optional aktivieren Sie das Kontrollkästchen **Verschlüsselt**, um es mit einem Passwort zu schützen. Drücken Sie **Ctrl+Enter** oder klicken Sie auf **Speichern**.

### Ein Snippet suchen und kopieren

1. Drücken Sie **Ctrl+Alt+Space** aus einer beliebigen Anwendung.
2. Beginnen Sie mit der Eingabe des Snippet-Titels. Die Liste filtert in Echtzeit.
3. Verwenden Sie **Pfeil nach oben / unten**, um durch die Ergebnisse zu navigieren.
4. Drücken Sie **Enter**, um das ausgewählte Snippet in die Zwischenablage zu kopieren.
5. Wechseln Sie zur Zielanwendung und fügen Sie ein (**Ctrl+V**).

Das QuickSnippets-Fenster wird automatisch ausgeblendet, wenn Sie wechseln.

### Systemtray

Das Anwendungssymbol befindet sich im Systemtray. Rechtsklick für schnellen Zugriff auf **Anzeigen**, **Neues Snippet**, **Einstellungen** und **Beenden**.

---

## Tastenkombinationen

### Global (funktioniert aus jeder Anwendung)

| Kombination | Aktion |
|---|---|
| Ctrl+Alt+Space | QuickSnippets-Fenster anzeigen / ausblenden |

### Im Hauptfenster

> Alle Buchstabenkombinationen (Ctrl+N, Ctrl+E, Ctrl+D, Ctrl+F usw.) verwenden die
> physische Tastenposition, funktionieren also unabhängig vom aktiven OS-Tastaturlayout.

| Kombination | Aktion |
|---|---|
| Pfeil nach oben / unten | Auswahl in der Snippet-Liste verschieben |
| Home / End | Zum ersten / letzten Snippet springen |
| Enter | Ausgewähltes Snippet in die Zwischenablage kopieren |
| Ctrl+N oder Insert | Neues Snippet erstellen |
| Ctrl+E | Ausgewähltes Snippet bearbeiten |
| Delete oder Ctrl+D | Ausgewähltes Snippet löschen |
| Ctrl+F oder / | Suchfeld fokussieren |
| Ctrl+, | Einstellungen öffnen |
| Ctrl+Shift+T | Helles / dunkles Design umschalten |
| Ctrl+Shift+Space | Ausgewähltes Snippet vorlesen (Screenreader) |
| Escape | Modal schließen / Suche leeren |
| Alt+F4 | Anwendung beenden |

### In Formularen und Dialogen

| Kombination | Aktion |
|---|---|
| Ctrl+Enter | Bestätigen / Speichern (funktioniert in allen Dialogen einschließlich Beenden- und Löschbestätigung) |
| Escape | Abbrechen und Modal schließen |

---

## Einstellungen

Öffnen Sie die Einstellungen mit **Ctrl+,** oder über das Tray-Menü.

| Einstellung | Beschreibung |
|---|---|
| Design | Helle oder dunkle Oberfläche |
| Sprache | Englisch, Ukrainisch, Deutsch oder automatische Erkennung aus dem System |
| Im Tray starten | Fenster beim Start ausblenden; nur das Tray-Symbol ist sichtbar |
| Mit Windows starten | QuickSnippets automatisch beim Windows-Start starten |
| Vor dem Schließen bestätigen | Bestätigungsdialog vor dem Beenden anzeigen |

---

## Für Entwickler

Siehe [DEVELOPMENT.md](DEVELOPMENT.md) für den vollständigen Entwicklerleitfaden: Voraussetzungen, Build-Befehle, Tests, der Release-Prozess und Fehlerbehebung.

Das Projekt verwendet **Tauri v2** (Rust-Backend) + **React 19 / TypeScript / Vite** (Frontend) und folgt einem TDD-Ansatz.

---

## Lizenz

[MIT](LICENSE) — Copyright (c) 2026 Ruslan Iskov
