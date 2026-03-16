<div align="center">
	<img src="logo-vector.svg" alt="QuickSnippets logo" />
	<h1>QuickSnippets</h1>
	<p><strong>Ein portabler Windows-Launcher für Ihre Textschnipsel — immer nur einen Tastendruck entfernt.</strong></p>
	<p>
		<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="Lizenz: MIT"></a>
		<a href="https://github.com/ruslan-rv-ua/quick-snippets/releases"><img src="https://img.shields.io/badge/Platform-Windows-0078D4.svg" alt="Plattform: Windows"></a>
	</p>
</div>

---

## Was ist QuickSnippets?

QuickSnippets ist eine kleine, portable Desktop-Anwendung, mit der Sie eine persönliche Bibliothek von Textschnipseln verwalten und diese innerhalb von Sekunden in jede beliebige Anwendung einfügen können.

Drücken Sie **Strg+Alt+Space** von überall auf Ihrem Desktop. Das Fenster erscheint, Sie tippen ein paar Buchstaben ein, um den gewünschten Schnipsel zu finden, drücken **Enter**, und schon befindet er sich in Ihrer Zwischenablage. Keine Cloud, keine Telemetrie, keine Installation erforderlich.

Vertrauliche Schnipsel können lokal mit AES-256-GCM verschlüsselt werden, sodass nur Sie — mit dem richtigen Passwort — Zugriff darauf haben.

---

## Funktionen

- **Sofortiger Zugriff** — globaler Hotkey zeigt das Fenster aus jeder Anwendung
- **Schnelle Suche** — unscharfe Suche (Fuzzy Search) filtert Ihre Schnipsel während der Eingabe
- **Verschlüsselte Schnipsel** — schützen Sie vertrauliche Inhalte mit einem Passwort (AES-256-GCM-Verschlüsselung, Schlüssel verlassen nie Ihr Gerät)
- **Vollständige Tastatursteuerung** — jede Aktion hat ein Tastenkürzel; die Maus ist optional
- **Screenreader-Unterstützung** — entwickelt für NVDA, JAWS und Windows Narrator
- **Portabel** — kein Installer, keine Registry, kein `AppData`; die gesamte App befindet sich in einem Ordner
- **System-Tray** — bleibt im Hintergrund, wenn nicht in Gebrauch; Rechtsklick auf das Tray-Icon für schnelle Aktionen
- **Helles und dunkles Design** — Wechsel mit einem einzigen Tastenkürzel oder über die Einstellungen
- **Drei Sprachen** — Englisch, Ukrainisch und Deutsch; Sprache wird automatisch vom System erkannt
- **Einzelinstanz** — erneutes Starten der App bringt einfach das bestehende Fenster in den Fokus
- **Automatisches Ausblenden** — das Fenster verschwindet, wenn Sie zu einer anderen Anwendung wechseln, genau wie ein Launcher
- **Automatisches Tippen** — drücken Sie `Umschalt+Enter`, um einen Schnipsel direkt in das aktive Fenster einzutippen, ohne die Zwischenablage zu verwenden

---

## Installation

QuickSnippets ist eine portable Anwendung — kein Installer erforderlich.

1. Gehen Sie zur [Releases-Seite](https://github.com/ruslan-rv-ua/quick-snippets/releases).
2. Laden Sie die neueste `quick-snippets-windows-x64-vX.Y.Z.zip` herunter.
3. Entpacken Sie die ZIP-Datei in einen beliebigen Ordner (z. B. `C:\Tools\QuickSnippets\`).
4. Starten Sie `quick-snippets.exe`.

### Installation über Scoop

Wenn Sie [Scoop](https://scoop.sh/) verwenden, können Sie QuickSnippets aus dem offiziellen Bucket installieren:

```powershell
scoop bucket add ruslan-rv-ua https://github.com/ruslan-rv-ua/scoop-bucket
scoop install quick-snippets
```

Ihre Schnipsel-Datenbank (`snippets.db`) und Einstellungen (`settings.json`) werden im selben Ordner wie die ausführbare Datei gespeichert. Um die App zu verschieben oder zu sichern, kopieren Sie den gesamten Ordner.

> **SHA-256-Prüfsumme** — eine `.sha256`-Datei ist jedem Release zur Überprüfung beigefügt.

---

## Erste Schritte

### Erster Start

Beim ersten Start ist die Schnipsel-Liste leer. Drücken Sie **Strg+N** (oder **Einfügen**), um Ihren ersten Schnipsel zu erstellen.

Geben Sie ihm einen kurzen, einprägsamen Titel — danach werden Sie suchen. Fügen Sie den Inhalt ein oder tippen Sie ihn ein. Optional können Sie ihn mit einem Passwort schützen. Drücken Sie **Strg+Enter** oder klicken Sie auf **Speichern**.

### Einen Schnipsel finden und kopieren

1. Drücken Sie **Strg+Alt+Space** aus jeder beliebigen Anwendung.
2. Beginnen Sie, den Titel des Schnipsels einzutippen. Die Liste filtert in Echtzeit.
3. Verwenden Sie **Pfeil hoch / runter**, um durch die Ergebnisse zu navigieren.
4. Drücken Sie **Enter**, um den ausgewählten Schnipsel in die Zwischenablage zu kopieren.
5. Wechseln Sie zu Ihrer Zielanwendung und fügen Sie ihn ein (**Strg+V**).

Alternativ können Sie **Umschalt+Enter** (statt **Enter**) drücken, um den Schnipsel direkt in das zuvor aktive Fenster einzutippen — ohne Zwischenablage. Das Fenster wird ausgeblendet, der Fokus kehrt zur Zielanwendung zurück, und der Text wird Zeichen für Zeichen eingegeben.

Das QuickSnippets-Fenster blendet sich automatisch aus, wenn Sie zu einer anderen Anwendung wechseln.

### System-Tray

Das Anwendungssymbol befindet sich im System-Tray. Klicken Sie mit der rechten Maustaste darauf für schnellen Zugriff auf **Anzeigen**, **Neuer Schnipsel**, **Einstellungen** und **Beenden**.

---

## Tastenkürzel

### Global (funktioniert aus jeder Anwendung)

| Kürzel | Aktion |
|---|---|
| Strg+Alt+Space | QuickSnippets-Fenster anzeigen / ausblenden |

### Im Hauptfenster

> Alle Buchstabenkürzel (Strg+N, Strg+E, Strg+D, Strg+F usw.) verwenden die physische Tastenposition, sodass sie unabhängig vom aktiven Tastaturlayout des Betriebssystems funktionieren.

| Kürzel | Aktion |
|---|---|
| Pfeil hoch / runter | Auswahl in der Schnipsel-Liste bewegen |
| Pos1 / Ende | Zum ersten / letzten Schnipsel springen |
| Enter | Ausgewählten Schnipsel in die Zwischenablage kopieren |
| Umschalt+Enter | Ausgewählten Schnipsel automatisch in die aktive Anwendung tippen |
| Strg+N oder Einfügen | Neuen Schnipsel erstellen |
| Strg+E | Ausgewählten Schnipsel bearbeiten |
| Entf oder Strg+D | Ausgewählten Schnipsel löschen |
| Strg+F oder / | Suchfeld fokussieren |
| Strg+, | Einstellungen öffnen |
| Strg+Umschalt+T | Helles / dunkles Design umschalten |
| Strg+Umschalt+Space | Ausgewählten Schnipsel ansagen (Screenreader) |
| Esc | Modal schließen / Suche leeren |
| Alt+F4 | Anwendung beenden |

### In Formularen und Dialogen

| Kürzel | Aktion |
|---|---|
| Strg+Enter | Bestätigen / Speichern (funktioniert in allen Dialogen, einschließlich Beenden- und Löschbestätigung) |
| Esc | Abbrechen und Modal schließen |

---

## Einstellungen

Öffnen Sie die Einstellungen mit **Strg+,** oder über das Tray-Menü.

| Einstellung | Beschreibung |
|---|---|
| Design | Helle oder dunkle Benutzeroberfläche |
| Sprache | Englisch, Ukrainisch, Deutsch oder automatisch vom System erkennen |
| Im Tray starten | Fenster beim Start ausblenden; nur das Tray-Icon ist sichtbar |
| Beim Start ausführen | QuickSnippets automatisch beim Windows-Start starten |
| Beim Schließen bestätigen | Bestätigungsdialog vor dem Beenden anzeigen |
| Autotipp-Verzögerung (ms) | Zeichenverzögerung beim automatischen Tippen (Standard: 1 ms). Auf `0` setzen für maximale Geschwindigkeit. Erhöhen Sie den Wert auf 10–50 ms, wenn Zeichen fehlen oder in falscher Reihenfolge erscheinen. **Hinweis:** Automatisches Tippen funktioniert nicht in Anwendungen mit erhöhten Berechtigungen (Als Administrator ausführen). |

---

## Lizenz

[MIT](LICENSE) — Copyright (c) 2026 Ruslan Iskov
