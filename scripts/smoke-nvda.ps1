<#
.SYNOPSIS
    Local smoke test of the release exe with NVDA running.

.DESCRIPTION
    Drives the real app with simulated key presses, checks every result through
    UI Automation, the clipboard and the registry, and reports what NVDA said
    during each step (read from nvda.log at the "input/output" logging level).

    What it protects:
    - Your data: the test runs a copy of the exe from a temp folder with its own
      empty quick-snippets-data folder. Your snippets and settings are not touched.
    - The test runs only its own copy. A running QuickSnippets is closed (the app
      allows only one copy) and is not started again afterwards.
    - Clipboard text is restored at the end. Test values are kept out of Windows
      clipboard history when the script runs in Windows PowerShell (STA).
    - Only the part of nvda.log written during this run is read.
    - While the app is hidden, focus stays in a small test window owned by this
      script, so NVDA does not describe your other programs into the report.
    - The autostart check is skipped if your own autostart entry exists.

    Do not touch the keyboard or mouse while it runs (about a minute).
    NVDA may announce notifications from other apps during the run; they end up in
    the report like any other speech.

    The settings hints and the app version are object descriptions: NVDA reads them
    only with "Report object descriptions" on (Object Presentation settings).
    The keyboard shortcuts help (F1) does not depend on that setting: every row is
    a list option whose name holds the keys and the action.

.EXAMPLE
    just smoke

.EXAMPLE
    powershell -NoProfile -File scripts/smoke-nvda.ps1 -Exe path\to\quick-snippets.exe
#>
[CmdletBinding()]
param(
    [string]$Exe,
    [string]$NvdaLog,
    [int]$TimeoutSec = 8,
    [int]$SpeechWaitSec = 5,
    [int]$SettleMs = 700
)

$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 does not set $PSScriptRoot inside param() defaults.
if (-not $Exe) { $Exe = Join-Path $PSScriptRoot '..\src-tauri\target\release\quick-snippets.exe' }

# Ukrainian UI strings from src/i18n/translations.ts ("uk"). The test copy runs with language = uk.
$UI = @{
    SearchPlaceholder = 'Пошук сніпетів'
    CreateTitle       = 'Створити сніпет'
    EditTitle         = 'Редагувати сніпет'
    TitleLabel        = 'Назва'
    Saved             = 'Збережено'
    Copied            = 'Скопійовано'
    EnterPassword     = 'Введіть пароль для розшифрування'
    WrongPassword     = 'Невірний пароль'
    Encrypted         = 'зашифровано'
    Settings          = 'Налаштування'
    TitleInvalid      = 'Назва має бути від 3 до 50 символів'
    ContentEmpty      = 'Вміст не може бути порожнім'
    PasswordMismatch  = 'Паролі не збігаються'
    # Settings dialog
    AppVersion        = 'QuickSnippets версія'
    GroupAppearance   = 'Вигляд і мова'
    GroupStartup      = 'Запуск і закриття'
    GroupAutotype     = 'Автодрук'
    Theme             = 'Тема'
    Dark              = 'Темна'
    Light             = 'Світла'
    Language          = 'Мова'
    Ukrainian         = 'Українська'
    German            = 'Deutsch'
    Autostart         = 'Запускати разом з Windows'
    AutostartHint     = 'Діє з наступного входу в Windows'
    StartInTray       = 'Запускати згорнутим у трей'
    StartInTrayHint   = 'Діє з наступного запуску. Вікно відкривається клавішами Ctrl+Alt+Space'
    ConfirmOnClose    = 'Питати перед закриттям програми'
    ConfirmOnCloseHint = 'Стосується Alt+F4 і кнопки закриття вікна'
    AutotypeDelay     = 'Затримка між символами'
    AutotypeDelayHint = '0 — найшвидше. Якщо символи губляться, спробуйте 10–50'
    Cancel            = 'Скасувати'
    Save              = 'Зберегти'
    SettingsGerman    = 'Einstellungen'
    # Keyboard shortcuts help (F1)
    HelpTitle         = 'Гарячі клавіші'
    HelpGroupGlobal   = 'Глобальні'
    HelpGroupMain     = 'Головне вікно'
    HelpGroupDialogs  = 'Форми й діалоги'
    Close             = 'Закрити'
}

# Every action in the help, in list order (helpShortcuts.uk in src/i18n/translations.ts).
# The first is also what NVDA reads when the help opens.
$HelpActions = @(
    'Показати вікно QuickSnippets'
    'Рухатися списком сніпетів'
    'Перейти до першого / останнього сніпета'
    'Скопіювати вибраний сніпет у буфер обміну'
    'Надрукувати вибраний сніпет в активній програмі'
    'Створити новий сніпет'
    'Редагувати вибраний сніпет'
    'Видалити вибраний сніпет'
    'Перейти до поля пошуку'
    'Відкрити налаштування'
    'Перемкнути світлу й темну тему'
    'Сортувати за датою створення'
    'Сортувати за датою зміни'
    'Сортувати за алфавітом'
    'Сортувати за часом останнього використання'
    'Оголосити вибраний сніпет'
    'Показати цей список гарячих клавіш'
    'Очистити пошук; якщо він порожній, сховати вікно'
    'Вийти з програми'
    'Підтвердити або зберегти, у будь-якому діалозі'
    'Скасувати й закрити діалог'
)

# Role and state words as NVDA says them in Ukrainian, English or German: any one counts.
$Role = @{
    Dialog     = 'діалог|dialog'
    Grouping   = 'групування|grouping|Gruppierung'
    ComboBox   = 'комбінований список|combo box|Kombinationsfeld'
    CheckBox   = 'прапорець|check box|Kontrollfeld'
    NotChecked = 'не позначено|not checked|nicht aktiviert'
    SpinButton = 'кнопка прокрутки|spin button|Drehschalter'
    Button     = 'кнопка|button|Schalter'
    List       = 'список|list|Liste'
}

# Throwaway values for the throwaway copy of the app.
$Data = @{
    PlainTitle    = 'smoke звичайний'
    PlainText     = 'Привіт з QuickSnippets 123'
    PlainEdited   = 'Привіт з QuickSnippets 123, змінено'
    SecretTitle   = 'smoke зашифрований'
    SecretText    = 'Секретний текст 456'
    Password      = 'smoke-pass-42'
    WrongPassword = 'wrong-pass'
    Sentinel      = 'quick-snippets smoke: clipboard not changed'
}

$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$TargetTitle = 'QuickSnippets smoke target'
$ReportPath = Join-Path $env:TEMP 'quick-snippets-smoke-report.txt'

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$IsSta = [Threading.Thread]::CurrentThread.ApartmentState -eq 'STA'

# ── Keyboard ─────────────────────────────────────────────────────────────────
# keybd_event with real scan codes: the app matches letter shortcuts by physical key
# (KeyboardEvent.code), which is empty without a scan code.
if (-not ('QsSmokeNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class QsSmokeNative {
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint mapType);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint mods, uint vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    // True when nobody holds Ctrl+Alt+Space: register it for a moment and release it at once.
    public static bool HotkeyFree() {
        const int id = 0x5153;
        if (!RegisterHotKey(IntPtr.Zero, id, 0x0001 | 0x0002 | 0x4000, 0x20)) return false;  // Alt|Ctrl|NoRepeat, Space
        UnregisterHotKey(IntPtr.Zero, id);
        return true;
    }

    public static uint ForegroundProcessId() {
        uint pid = 0;
        GetWindowThreadProcessId(GetForegroundWindow(), out pid);
        return pid;
    }
    [DllImport("user32.dll", EntryPoint = "GetWindowThreadProcessId")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    // Windows only lets the foreground owner switch the foreground window. Sharing the
    // current foreground thread's input state for a moment lets this process do it.
    public static bool Activate(IntPtr hwnd) {
        IntPtr fg = GetForegroundWindow();
        if (fg == hwnd) return true;
        uint me = GetCurrentThreadId();
        uint fgThread = fg == IntPtr.Zero ? 0 : GetWindowThreadProcessId(fg, IntPtr.Zero);
        bool attached = fgThread != 0 && fgThread != me && AttachThreadInput(me, fgThread, true);
        try {
            BringWindowToTop(hwnd);
            SetForegroundWindow(hwnd);
        } finally {
            if (attached) AttachThreadInput(me, fgThread, false);
        }
        return GetForegroundWindow() == hwnd;
    }
    public static void Chord(byte[] vks, bool[] extended) {
        for (int i = 0; i < vks.Length; i++) {
            keybd_event(vks[i], (byte)MapVirtualKey(vks[i], 0), extended[i] ? 1u : 0u, UIntPtr.Zero);
            Thread.Sleep(30);
        }
        for (int i = vks.Length - 1; i >= 0; i--) {
            keybd_event(vks[i], (byte)MapVirtualKey(vks[i], 0), (extended[i] ? 1u : 0u) | 2u, UIntPtr.Zero);
            Thread.Sleep(30);
        }
    }
}
'@
}

$VK = @{ Ctrl = 0x11; Alt = 0x12; Shift = 0x10; Space = 0x20; Enter = 0x0D; Tab = 0x09; Esc = 0x1B
         Comma = 0xBC; Down = 0x28; Up = 0x26; Home = 0x24; End = 0x23; Delete = 0x2E; F1 = 0x70 }
$ExtendedVK = @(0x28, 0x26, 0x24, 0x23, 0x2E)

function Send-Keys([string[]]$Chords) {
    foreach ($chord in $Chords) {
        $vks = New-Object System.Collections.Generic.List[byte]
        $ext = New-Object System.Collections.Generic.List[bool]
        foreach ($name in $chord.Split('+')) {
            if ($VK.ContainsKey($name)) { $code = [int]$VK[$name] }
            elseif ($name.Length -eq 1) { $code = [int][char]$name.ToUpperInvariant() }
            else { throw "Невідома клавіша: $name" }
            $vks.Add([byte]$code)
            $ext.Add($ExtendedVK -contains $code)
        }
        [QsSmokeNative]::Chord($vks.ToArray(), $ext.ToArray())
        Start-Sleep -Milliseconds 250
    }
}

# ── Clipboard ────────────────────────────────────────────────────────────────
function Set-ClipText([string]$Text) {
    if ($IsSta) {
        $obj = New-Object System.Windows.Forms.DataObject
        $obj.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $Text)
        # Keep test values out of Windows clipboard history and cloud clipboard.
        foreach ($fmt in 'ExcludeClipboardContentFromMonitorProcessing', 'CanIncludeInClipboardHistory', 'CanUploadToCloudClipboard') {
            $obj.SetData($fmt, [IO.MemoryStream]::new([byte[]](0, 0, 0, 0)))
        }
        [System.Windows.Forms.Clipboard]::SetDataObject($obj, $true, 10, 100)
    } else {
        Set-Clipboard -Value $Text
    }
}

function Get-ClipText {
    try { return [string](Get-Clipboard -Raw) } catch { return '' }
}

# Paste instead of typing: simulated typing loses characters while NVDA's keyboard hook is active.
function Send-Text([string]$Text) {
    Set-ClipText $Text
    Start-Sleep -Milliseconds 100
    Send-Keys 'Ctrl+V'
}

# ── UI Automation ────────────────────────────────────────────────────────────
function New-Condition($Property, $Value) {
    return [System.Windows.Automation.PropertyCondition]::new($Property, $Value)
}

function Get-TopWindow([int]$ProcId, [string]$Name) {
    $c = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]@(
            (New-Condition $AE::ProcessIdProperty $ProcId),
            (New-Condition $AE::NameProperty $Name)))
    return $AE::RootElement.FindFirst($Scope::Children, $c)
}

function Find-Element($Root, [string]$Id, [string]$Name, $Type) {
    if ($null -eq $Root) { return $null }
    $conds = @()
    if ($Id) { $conds += New-Condition $AE::AutomationIdProperty $Id }
    if ($Name) { $conds += New-Condition $AE::NameProperty $Name }
    if ($Type) { $conds += New-Condition $AE::ControlTypeProperty $Type }
    if ($conds.Count -eq 1) { $c = $conds[0] }
    else { $c = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]$conds) }
    return $Root.FindFirst($Scope::Descendants, $c)
}

function Test-HasFocus($Element) {
    return ($null -ne $Element) -and $Element.Current.HasKeyboardFocus
}

function Get-AppWindow {
    if (-not $script:AppProc) { return $null }
    return Get-TopWindow $script:AppProc.Id 'QuickSnippets'
}

function Get-SearchBox {
    return Find-Element (Get-AppWindow) -Type ([System.Windows.Automation.ControlType]::ComboBox)
}

function Get-FocusedListItem {
    $w = Get-AppWindow
    if ($null -eq $w) { return $null }
    $c = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]@(
            (New-Condition $AE::ControlTypeProperty ([System.Windows.Automation.ControlType]::ListItem)),
            (New-Condition $AE::HasKeyboardFocusProperty $true)))
    return $w.FindFirst($Scope::Descendants, $c)
}

# The main window is in the foreground and focus is in the search box or on a snippet
# (with a non-empty list the search combo box reports the selected snippet as focused).
function Test-AppReady {
    $w = Get-AppWindow
    if ($null -eq $w) { return $false }
    if ([QsSmokeNative]::GetForegroundWindow() -ne [IntPtr]$w.Current.NativeWindowHandle) { return $false }
    return (Test-HasFocus (Get-SearchBox)) -or ($null -ne (Get-FocusedListItem))
}

# Shows the app with the hotkey, or, once the hotkey is known to be broken, by starting
# the exe again (single instance: a second launch brings up the running window).
function Show-App {
    if ($script:HotkeyBroken) { Start-Process $TestExe } else { Send-Keys 'Ctrl+Alt+Space' }
    Wait-Until 'вікно програми з фокусом' { Test-AppReady }
}

function Find-TextLike([string]$Pattern) {
    $w = Get-AppWindow
    if ($null -eq $w) { return $null }
    $texts = $w.FindAll($Scope::Descendants, (New-Condition $AE::ControlTypeProperty ([System.Windows.Automation.ControlType]::Text)))
    foreach ($e in $texts) { if ($e.Current.Name -like $Pattern) { return $e } }
    return $null
}

# Process name only (never the window title): names the window that had the keyboard.
function Get-ForegroundProcessName {
    try { return (Get-Process -Id ([QsSmokeNative]::ForegroundProcessId())).ProcessName } catch { return 'невідомо' }
}

function Wait-Until([string]$What, [scriptblock]$Condition, [int]$Seconds = $TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try { $r = & $Condition; if ($r) { return $r } } catch { }
        Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    throw "не дочекався: $What"
}

function Set-Toggle($Element, [bool]$On) {
    $tp = $Element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
    $want = if ($On) { 'On' } else { 'Off' }
    if ($tp.Current.ToggleState.ToString() -ne $want) { $tp.Toggle() }
    $null = Wait-Until "перемикач у стані $want" { $tp.Current.ToggleState.ToString() -eq $want } 3
}

function Get-RunValue {
    return (Get-ItemProperty -Path $RunKey -Name 'QuickSnippets' -ErrorAction SilentlyContinue).QuickSnippets
}

# ── Home window ──────────────────────────────────────────────────────────────
# A small window with one text field, owned by this script, open for the whole run.
# It is the window the app returns focus to whenever it hides, so NVDA describes it
# instead of your own programs, and it is the target for the autotype check.
# It runs on its own STA thread in this process: no extra console window.
function Start-Target {
    $script:TargetSync = [hashtable]::Synchronized(@{ Text = ''; Handle = [IntPtr]::Zero; Title = $TargetTitle })
    $rs = [runspacefactory]::CreateRunspace()
    $rs.ApartmentState = 'STA'
    $rs.ThreadOptions = 'ReuseThread'
    $rs.Open()
    $rs.SessionStateProxy.SetVariable('sync', $script:TargetSync)
    $ps = [powershell]::Create()
    $ps.Runspace = $rs
    $null = $ps.AddScript({
            Add-Type -AssemblyName System.Windows.Forms
            $f = New-Object System.Windows.Forms.Form
            $f.Text = $sync.Title
            $f.StartPosition = 'CenterScreen'
            $f.Width = 500
            $f.Height = 120
            $t = New-Object System.Windows.Forms.TextBox
            $t.Dock = 'Top'
            $t.AccessibleName = 'Smoke target'
            $t.Add_TextChanged({ $sync.Text = $t.Text })
            $f.Controls.Add($t)
            $f.Add_Shown({ $sync.Handle = $f.Handle; $f.Activate(); $t.Focus() })
            [void]$f.ShowDialog()
            $f.Dispose()
        })
    $script:TargetPs = $ps
    $script:TargetAsync = $ps.BeginInvoke()
    $null = Wait-Until 'тестове вікно' { $script:TargetSync.Handle -ne [IntPtr]::Zero } 15
    Enter-Target
}

function Test-TargetFocused {
    return $script:TargetSync -and $script:TargetSync.Handle -ne [IntPtr]::Zero -and
        [QsSmokeNative]::GetForegroundWindow() -eq $script:TargetSync.Handle
}

# Makes sure the home window is in the foreground (Windows may refuse the first attempt).
function Enter-Target {
    try { $null = Wait-Until 'фокус у тестовому вікні' { Test-TargetFocused } 1 }
    catch {
        $null = Wait-Until 'фокус у тестовому вікні' {
            $null = [QsSmokeNative]::Activate($script:TargetSync.Handle)
            Start-Sleep -Milliseconds 150
            Test-TargetFocused
        } 5
    }
}

function Get-TargetText {
    if (-not $script:TargetSync) { return $null }
    return [string]$script:TargetSync.Text
}

function Stop-Target {
    if ($script:TargetSync -and $script:TargetSync.Handle -ne [IntPtr]::Zero) {
        $null = [QsSmokeNative]::PostMessage($script:TargetSync.Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)  # WM_CLOSE
    }
    if ($script:TargetPs) {
        try { $null = $script:TargetAsync.AsyncWaitHandle.WaitOne(3000) } catch { }
        try { $script:TargetPs.Runspace.Dispose(); $script:TargetPs.Dispose() } catch { }
    }
    $script:TargetPs = $null
    $script:TargetSync = $null
}

# ── NVDA log ─────────────────────────────────────────────────────────────────
# Positions are byte offsets in nvda.log: each step reads only what NVDA wrote during it.
function Get-LogLength {
    if (-not $script:LogPath) { return 0 }
    $fs = [IO.File]::Open($script:LogPath, 'Open', 'Read', 'ReadWrite')
    try { return $fs.Length } finally { $fs.Dispose() }
}

function Read-LogRange([long]$From, [long]$To) {
    if (-not $script:LogPath) { return '' }
    $fs = [IO.File]::Open($script:LogPath, 'Open', 'Read', 'ReadWrite')
    try {
        if ($From -gt $fs.Length) { $From = 0 }  # NVDA restarted and began a new log
        if ($To -gt $fs.Length -or $To -lt $From) { $To = $fs.Length }
        $count = [int]($To - $From)
        $buf = New-Object byte[] $count
        $null = $fs.Seek($From, 'Begin')
        $read = 0
        while ($read -lt $count) {
            $n = $fs.Read($buf, $read, $count - $read)
            if ($n -le 0) { break }
            $read += $n
        }
        return [Text.Encoding]::UTF8.GetString($buf, 0, $read)
    } finally { $fs.Dispose() }
}

$HeaderRx = [regex]'^(?<lvl>[A-Z]+) - (?<src>\S+) \((?<t>\d\d:\d\d:\d\d\.\d{3})\) - .*:\s*$'
# Speech commands such as LangChangeCommand ('uk_UA') carry quoted arguments that are not speech.
$CommandRx = [regex]"\b\w+Command\s*\((?:[^()'""]|'(?:[^'\\]|\\.)*'|""(?:[^""\\]|\\.)*"")*\)"
$StringRx = [regex]"'((?:[^'\\]|\\.)*)'|""((?:[^""\\]|\\.)*)"""

function ConvertFrom-PyLiteral([string]$Text) {
    return [regex]::Replace($Text, '\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|.)', {
            param($m)
            $e = $m.Groups[1].Value
            if ($e.Length -gt 1) { return [string][char][Convert]::ToInt32($e.Substring(1), 16) }
            if ($e -ceq 'n' -or $e -ceq 't' -or $e -ceq 'r') { return ' ' }
            return $e
        })
}

function Get-SpeechText([string]$Line) {
    $body = $CommandRx.Replace($Line.Substring('Speaking'.Length), '')
    $parts = foreach ($m in $StringRx.Matches($body)) {
        $raw = if ($m.Groups[1].Success) { $m.Groups[1].Value } else { $m.Groups[2].Value }
        $t = ((ConvertFrom-PyLiteral $raw) -replace '\s+', ' ').Trim()
        if ($t) { $t }
    }
    return ($parts -join ', ')
}

function Get-NvdaEvents([string]$Text) {
    $cur = $null
    foreach ($line in ($Text -split '\r?\n')) {
        $h = $HeaderRx.Match($line)
        if ($h.Success) { $cur = $h; continue }
        if ($null -eq $cur) { continue }
        $src = $cur.Groups['src'].Value
        $lvl = $cur.Groups['lvl'].Value
        if ($src -eq 'speech.speech.speak' -and $line.StartsWith('Speaking')) {
            $s = Get-SpeechText $line
            if ($s) { [pscustomobject]@{ Kind = 'say'; Text = $s } }
        } elseif ($lvl -eq 'ERROR' -or $lvl -eq 'CRITICAL') {
            [pscustomobject]@{ Kind = 'error'; Text = ('{0}: {1}' -f $src, $line.Trim()) }
        }
        $cur = $null
    }
}

function Get-Count([string]$Haystack, [string]$Needle) {
    if (-not $Needle -or -not $Haystack) { return 0 }
    $i = 0; $n = 0
    while (($i = $Haystack.IndexOf($Needle, $i, [StringComparison]::OrdinalIgnoreCase)) -ge 0) {
        $n++
        $i += $Needle.Length
    }
    return $n
}

# True when any of the '|'-separated variants was said.
function Test-SaidAny([string]$Haystack, [string]$Variants) {
    foreach ($v in $Variants.Split('|')) { if ((Get-Count $Haystack $v) -ge 1) { return $true } }
    return $false
}

# ── Steps ────────────────────────────────────────────────────────────────────
$Results = New-Object System.Collections.Generic.List[object]
$Notes = New-Object System.Collections.Generic.List[string]
$script:Aborted = $false
$script:HotkeyBroken = $false
$script:SoftFail = $null
$script:SetupError = ''
$script:NvdaErrors = @()

function Get-StepSpeech([long]$From) {
    return @(Get-NvdaEvents (Read-LogRange $From (Get-LogLength)))
}

function Get-SaidText($Events) {
    return (@($Events | Where-Object { $_.Kind -eq 'say' } | ForEach-Object { $_.Text }) -join ' | ')
}

# Expect      - must be said at least once
# ExpectAny   - for each entry, one of its '|'-separated variants must be said
#               (role and state words, which depend on NVDA's language)
# ExpectCount - must be said exactly N times, e.g. @{ 'Збережено' = 2 }
# Forbid      - must not be said
# Hope        - nice to hear, reported but never a failure (speech that races with the window hiding)
function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action,
        [string[]]$Expect = @(),
        [string[]]$ExpectAny = @(),
        [hashtable]$ExpectCount = @{},
        [string[]]$Forbid = @(),
        [string[]]$Hope = @(),
        [string]$SkipReason
    )
    $r = [pscustomobject]@{ N = $Results.Count + 1; Title = $Title; Status = 'OK'; Detail = ''; Speech = @(); Checks = @() }
    if ($SkipReason) { $r.Status = 'ПРОПУЩЕНО'; $r.Detail = $SkipReason; $Results.Add($r); return }
    if ($script:Aborted) { $r.Status = 'ПРОПУЩЕНО'; $r.Detail = 'попередній крок не вдався'; $Results.Add($r); return }

    $from = Get-LogLength
    $script:SoftFail = $null  # a step sets this to fail without stopping the remaining steps
    try { $null = & $Action }
    catch { $r.Status = 'ПОМИЛКА'; $r.Detail = $_.Exception.Message; $script:Aborted = $true }
    if ($r.Status -eq 'OK' -and $script:SoftFail) { $r.Status = 'ПОМИЛКА'; $r.Detail = $script:SoftFail }

    if ($script:LogPath -and $r.Status -eq 'OK' -and ($Expect.Count -or $ExpectAny.Count -or $ExpectCount.Count)) {
        # NVDA can lag behind the app: wait until it has said what we expect.
        $deadline = (Get-Date).AddSeconds($SpeechWaitSec)
        do {
            $said = Get-SaidText (Get-StepSpeech $from)
            $done = $true
            foreach ($p in $Expect) { if ((Get-Count $said $p) -lt 1) { $done = $false } }
            foreach ($a in $ExpectAny) { if (-not (Test-SaidAny $said $a)) { $done = $false } }
            foreach ($k in $ExpectCount.Keys) { if ((Get-Count $said $k) -lt $ExpectCount[$k]) { $done = $false } }
            if ($done) { break }
            Start-Sleep -Milliseconds 200
        } while ((Get-Date) -lt $deadline)
    }
    Start-Sleep -Milliseconds $SettleMs  # catch trailing speech, e.g. a repeated announcement

    if ($script:LogPath) {
        $events = Get-StepSpeech $from
        $r.Speech = @($events | Where-Object { $_.Kind -eq 'say' } | ForEach-Object { $_.Text })
        $script:NvdaErrors += @($events | Where-Object { $_.Kind -eq 'error' } | ForEach-Object { $_.Text })
        $all = $r.Speech -join ' | '
        $checks = @()
        foreach ($p in $Expect) {
            $checks += [pscustomobject]@{ Text = "звучить «$p»"; Ok = (Get-Count $all $p) -ge 1; Required = $true }
        }
        foreach ($a in $ExpectAny) {
            $variants = ($a.Split('|') | ForEach-Object { "«$_»" }) -join ' або '
            $checks += [pscustomobject]@{ Text = "звучить $variants"; Ok = (Test-SaidAny $all $a); Required = $true }
        }
        foreach ($k in $ExpectCount.Keys) {
            $c = Get-Count $all $k
            $checks += [pscustomobject]@{ Text = "«$k» звучить разів: $($ExpectCount[$k]) (прозвучало: $c)"; Ok = $c -eq $ExpectCount[$k]; Required = $true }
        }
        foreach ($p in $Forbid) {
            $checks += [pscustomobject]@{ Text = "не звучить «$p»"; Ok = (Get-Count $all $p) -eq 0; Required = $true }
        }
        foreach ($p in $Hope) {
            $checks += [pscustomobject]@{ Text = "бажано, щоб звучало «$p»"; Ok = (Get-Count $all $p) -ge 1; Required = $false }
        }
        $r.Checks = $checks
    }
    $Results.Add($r)
}

# ── Preparation ──────────────────────────────────────────────────────────────
if (-not (Test-Path $Exe)) {
    Write-Host "Не знайдено $Exe"
    Write-Host 'Спершу зберіть програму: npx tauri build --no-bundle'
    exit 2
}
$Exe = (Resolve-Path $Exe).Path
$exeTime = (Get-Item $Exe).LastWriteTime
$repo = Split-Path $PSScriptRoot -Parent
# Uncommitted code edits made after the build (file dates alone mislead after git checkout/rebase).
$newer = $null
try {
    foreach ($l in @(git -C $repo status --porcelain -- src src-tauri 2>$null)) {
        $f = Join-Path $repo $l.Substring(3).Trim('"')
        if ($f -notmatch '[\\/](__tests__|test)[\\/]' -and (Test-Path $f -PathType Leaf) -and (Get-Item $f).LastWriteTime -gt $exeTime) {
            $newer = Split-Path $f -Leaf
            break
        }
    }
} catch { }

$nvdaRunning = [bool](Get-Process nvda -ErrorAction SilentlyContinue)
if (-not $NvdaLog) {
    foreach ($dir in $env:TEMP, $env:TMP) {
        if ($dir -and (Test-Path (Join-Path $dir 'nvda.log'))) { $NvdaLog = Join-Path $dir 'nvda.log'; break }
    }
}
$script:LogPath = if ($nvdaRunning -and $NvdaLog -and (Test-Path $NvdaLog)) { $NvdaLog } else { $null }

Write-Host 'Перевірка QuickSnippets з NVDA.'
if ($newer) { Write-Host "Увага: exe зібрано до змін у коді ($newer). Щоб перевірити свіжі зміни, перезберіть: npx tauri build --no-bundle" }
if (-not $script:LogPath) { Write-Host 'NVDA не запущено або лог не знайдено: перевіряю лише програму.' }
if (Get-Process quick-snippets -ErrorAction SilentlyContinue) {
    Write-Host 'Вашу копію QuickSnippets буде закрито: тест запускає лише свою копію.'
}
Write-Host 'Тест триває близько хвилини. Не торкайтеся клавіатури й миші, доки не прозвучить «Готово».'
Start-Sleep -Seconds 4

# Closed before the test and not started again: the test runs only its own copy.
$UserApps = @(Get-Process quick-snippets -ErrorAction SilentlyContinue)
$UserRunValue = Get-RunValue
$ClipBackup = $null
$ClipHadText = $true
if ($IsSta) { $ClipHadText = [System.Windows.Forms.Clipboard]::ContainsText() }
if ($ClipHadText) { $ClipBackup = Get-ClipText }

$Work = Join-Path $env:TEMP ('quick-snippets-smoke-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$TestExe = Join-Path $Work 'quick-snippets.exe'
$script:AppProc = $null
$script:TargetPs = $null
$script:TargetSync = $null

try {
    if ($UserApps.Count) {
        $UserApps | Stop-Process -Force
        $UserApps | ForEach-Object { $null = $_.WaitForExit(5000) }
    }
    # Windows frees the hotkey of a closed process a moment later. A test copy started
    # before that silently runs without Ctrl+Alt+Space.
    try { $null = Wait-Until 'Ctrl+Alt+Space вільна' { [QsSmokeNative]::HotkeyFree() } 10 }
    catch { $Notes.Add('Ctrl+Alt+Space зайнята іншою програмою ще до запуску тестової копії QuickSnippets.') }

    $dataDir = Join-Path $Work 'quick-snippets-data'
    $null = New-Item -ItemType Directory -Force -Path $dataDir
    Copy-Item $Exe $TestExe
    $settings = [ordered]@{
        # Like a default install: the window opens at launch (start_in_tray off).
        theme = 'dark'; start_in_tray = $false; autostart = $false; confirm_on_close = $false; language = 'uk'
        window_state = [ordered]@{ x = 100; y = 100; width = 680; height = 520 }
        # 7: a value that no label or hint of the settings dialog contains, so the
        # settings steps can check that NVDA reads the value of the delay field.
        autotype_delay_ms = 7; sort_mode = 'modified'; sort_direction = 'desc'
    }
    # No BOM: serde_json rejects it.
    [IO.File]::WriteAllText((Join-Path $dataDir 'settings.json'), ($settings | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))

    # The home window first: the app window then opens over it, and focus returns to it
    # whenever the app hides.
    try { Start-Target }
    catch {
        $script:Aborted = $true
        $script:SetupError = "не вдалося відкрити тестове вікно: $($_.Exception.Message)"
    }
    $script:AppProc = Start-Process $TestExe -PassThru

    # NVDA may stay silent about the very first show of a freshly started window until the
    # next key press, so this step only hopes for speech; later shows are checked strictly.
    Invoke-Step 'Запуск: вікно відкривається з фокусом у полі пошуку, Escape його ховає' {
        $null = Wait-Until 'вікно програми після запуску' { Get-AppWindow } 20
        if (-not (Test-AppReady)) {
            $w = Get-AppWindow
            $null = [QsSmokeNative]::Activate([IntPtr]$w.Current.NativeWindowHandle)
        }
        $null = Wait-Until 'фокус у полі пошуку' { Test-HasFocus (Get-SearchBox) }
        Send-Keys 'Esc'
        Wait-Until 'вікно сховалось' { -not (Get-AppWindow) }
    } -Hope $UI.SearchPlaceholder

    Invoke-Step 'Ctrl+Alt+Space показує вікно, фокус у полі пошуку' {
        Send-Keys 'Ctrl+Alt+Space'
        $shown = $true
        try { $null = Wait-Until 'вікно програми' { Get-AppWindow } 6 }
        catch {
            Send-Keys 'Ctrl+Alt+Space'  # the app may still have been starting
            try { $null = Wait-Until 'вікно програми' { Get-AppWindow } 4 } catch { $shown = $false }
        }
        if (-not $shown) {
            if ($script:AppProc.HasExited) { throw "програма завершилась, код $($script:AppProc.ExitCode)" }
            $fg = Get-ForegroundProcessName
            # Open the window another way, so the remaining steps can still run.
            $script:HotkeyBroken = $true
            Start-Process $TestExe
            $null = Wait-Until 'вікно після повторного запуску exe' { Get-AppWindow } 8
            $warned = $false
            try { $warned = [bool](Wait-Until 'попередження про гарячу клавішу' { (Find-TextLike '*hotkey*') -or (Find-TextLike '*гаряч*') } 3) } catch { }
            if ($warned) { $script:SoftFail = 'Ctrl+Alt+Space не відкрила вікно: програма повідомила, що не змогла зареєструвати гарячу клавішу' }
            else { $script:SoftFail = "Ctrl+Alt+Space не відкрила вікно (клавіатура була в процесі $fg)" }
            $script:SoftFail += '; далі вікно відкривається повторним запуском exe'
        }
        Wait-Until 'фокус у полі пошуку' { Test-HasFocus (Get-SearchBox) }
    } -Expect $UI.SearchPlaceholder

    Invoke-Step 'Ctrl+N відкриває діалог створення, фокус у полі «Назва»' {
        Send-Keys 'Ctrl+N'
        Wait-Until 'фокус у полі «Назва»' { Test-HasFocus (Find-Element (Get-AppWindow) -Id 'create-title') }
    } -Expect $UI.CreateTitle, $UI.TitleLabel

    $plainItem = { Find-Element (Get-AppWindow) -Name $Data.PlainTitle -Type ([System.Windows.Automation.ControlType]::ListItem) }

    # Two saves less than a second apart, while the window stays open (a toast lives 2 s):
    # each must be announced once, so a stale toast read again shows up as a third «Збережено».
    Invoke-Step 'Ctrl+Enter зберігає новий сніпет; Ctrl+E і одразу Ctrl+Enter зберігають його ще раз' {
        Send-Text $Data.PlainTitle
        Send-Keys 'Tab'
        Send-Text $Data.PlainText
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'новий сніпет у списку з фокусом' { Test-HasFocus (& $plainItem) }
        Send-Keys 'Ctrl+E'
        Wait-Until 'фокус у полі «Назва» діалогу редагування' { Test-HasFocus (Find-Element (Get-AppWindow) -Id 'edit-title') }
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'діалог редагування закрито, фокус на сніпеті' {
            -not (Find-Element (Get-AppWindow) -Id 'edit-title') -and (Test-HasFocus (& $plainItem))
        }
    } -Expect $Data.PlainTitle, $UI.EditTitle -ExpectCount @{ ($UI.Saved) = 2 }

    Invoke-Step 'Ctrl+E змінює вміст сніпета' {
        Send-Keys 'Ctrl+E'
        Wait-Until 'фокус у полі «Назва» діалогу редагування' { Test-HasFocus (Find-Element (Get-AppWindow) -Id 'edit-title') }
        Send-Keys 'Tab', 'Ctrl+A'
        Send-Text $Data.PlainEdited
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'діалог редагування закрито, фокус на сніпеті' {
            -not (Find-Element (Get-AppWindow) -Id 'edit-title') -and (Test-HasFocus (& $plainItem))
        }
    } -Expect $UI.EditTitle

    # Validation errors: each message must be said once, with its text, and focus must
    # be on the invalid field. The dialogs are closed with Escape, so no snippet is added.
    $appWin = { Get-AppWindow }
    $hasFocus = { param($id) Test-HasFocus (Find-Element (& $appWin) -Id $id) }

    Invoke-Step 'Створення, порожній вміст: повідомлення один раз, фокус у полі «Вміст»' {
        Send-Keys 'Ctrl+N'
        Wait-Until 'фокус у полі «Назва»' { & $hasFocus 'create-title' }
        Send-Text $Data.PlainTitle
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'текст помилки' { Find-Element (& $appWin) -Name $UI.ContentEmpty }
        Wait-Until 'фокус у полі «Вміст»' { & $hasFocus 'create-content' }
    } -ExpectCount @{ ($UI.ContentEmpty) = 1 } -Forbid $UI.TitleInvalid

    Invoke-Step 'Створення, порожня назва: повідомлення один раз, фокус у полі «Назва»' {
        Send-Text $Data.PlainText
        Send-Keys 'Shift+Tab'
        Wait-Until 'фокус у полі «Назва»' { & $hasFocus 'create-title' }
        Send-Keys 'Ctrl+A', 'Delete'
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'текст помилки' { Find-Element (& $appWin) -Name $UI.TitleInvalid }
        Wait-Until 'фокус у полі «Назва»' { & $hasFocus 'create-title' }
    } -ExpectCount @{ ($UI.TitleInvalid) = 1 } -Forbid $UI.ContentEmpty

    # Focus is already in the confirmation field when the error appears.
    Invoke-Step 'Створення, паролі не збігаються: повідомлення один раз, фокус у полі підтвердження' {
        Send-Text $Data.SecretTitle
        Send-Keys 'Tab', 'Tab'
        Wait-Until 'фокус у полі пароля' { & $hasFocus 'create-password' }
        Send-Text $Data.Password
        Send-Keys 'Tab'
        Wait-Until 'фокус у полі підтвердження' { & $hasFocus 'create-confirm' }
        Send-Text $Data.WrongPassword
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'текст помилки' { Find-Element (& $appWin) -Name $UI.PasswordMismatch }
        Wait-Until 'фокус у полі підтвердження' { & $hasFocus 'create-confirm' }
    } -ExpectCount @{ ($UI.PasswordMismatch) = 1 } -Forbid $UI.TitleInvalid, $UI.ContentEmpty

    Invoke-Step 'Escape закриває діалог створення без збереження' {
        Send-Keys 'Esc'
        Wait-Until 'діалог створення закрито, фокус на сніпеті' {
            -not (Find-Element (& $appWin) -Id 'create-title') -and (Test-HasFocus (& $plainItem))
        }
    } -Forbid $UI.Saved

    Invoke-Step 'Редагування, порожня назва: повідомлення один раз, фокус у полі «Назва»' {
        Send-Keys 'Ctrl+E'
        Wait-Until 'фокус у полі «Назва» діалогу редагування' { & $hasFocus 'edit-title' }
        Send-Keys 'Ctrl+A', 'Delete'
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'текст помилки' { Find-Element (& $appWin) -Name $UI.TitleInvalid }
        Wait-Until 'фокус у полі «Назва»' { & $hasFocus 'edit-title' }
    } -ExpectCount @{ ($UI.TitleInvalid) = 1 }

    # Focus is already in the content field when the error appears.
    Invoke-Step 'Редагування, порожній вміст: повідомлення один раз, фокус у полі «Вміст»' {
        Send-Text $Data.PlainTitle
        Send-Keys 'Tab'
        Wait-Until 'фокус у полі «Вміст»' { & $hasFocus 'edit-content' }
        Send-Keys 'Ctrl+A', 'Delete'
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'текст помилки' { Find-Element (& $appWin) -Name $UI.ContentEmpty }
        Wait-Until 'фокус у полі «Вміст»' { & $hasFocus 'edit-content' }
    } -ExpectCount @{ ($UI.ContentEmpty) = 1 } -Forbid $UI.TitleInvalid

    Invoke-Step 'Escape закриває діалог редагування без збереження' {
        Send-Keys 'Esc'
        Wait-Until 'діалог редагування закрито, фокус на сніпеті' {
            -not (Find-Element (& $appWin) -Id 'edit-title') -and (Test-HasFocus (& $plainItem))
        }
    } -Forbid $UI.Saved

    Invoke-Step 'Enter копіює сніпет і ховає вікно' {
        Set-ClipText $Data.Sentinel
        Send-Keys 'Enter'
        Wait-Until 'текст сніпета в буфері обміну' { (Get-ClipText) -eq $Data.PlainEdited }
        Wait-Until 'вікно сховалось' { -not (Get-AppWindow) }
    } -Forbid $UI.Saved -Hope $UI.Copied

    Invoke-Step 'Shift+Enter друкує сніпет в інше вікно' {
        Enter-Target
        Send-Keys 'Ctrl+A', 'Delete'
        $null = Wait-Until 'тестове поле порожнє' { (Get-TargetText) -eq '' } 3
        Show-App
        Send-Keys 'Down', 'Shift+Enter'
        Wait-Until 'текст надруковано в тестовому вікні' { (Get-TargetText) -eq $Data.PlainEdited }
    }

    Invoke-Step 'Створення зашифрованого сніпета' {
        Show-App
        Send-Keys 'Ctrl+N'
        Wait-Until 'фокус у полі «Назва»' { Test-HasFocus (Find-Element (Get-AppWindow) -Id 'create-title') }
        Send-Text $Data.SecretTitle; Send-Keys 'Tab'
        Send-Text $Data.SecretText; Send-Keys 'Tab'
        Send-Text $Data.Password; Send-Keys 'Tab'
        Send-Text $Data.Password; Send-Keys 'Ctrl+Enter'
        $name = '{0} ({1})' -f $Data.SecretTitle, $UI.Encrypted
        Wait-Until 'зашифрований сніпет у списку з фокусом' {
            Test-HasFocus (Find-Element (Get-AppWindow) -Name $name -Type ([System.Windows.Automation.ControlType]::ListItem))
        }
    } -ExpectCount @{ ($UI.Saved) = 1 } -Expect $UI.Encrypted

    Invoke-Step 'Enter на зашифрованому сніпеті питає пароль' {
        Set-ClipText $Data.Sentinel
        Send-Keys 'Enter'
        Wait-Until 'фокус у полі пароля' { Test-HasFocus (Find-Element (Get-AppWindow) -Id 'pwd-input') }
        if ((Get-ClipText) -ne $Data.Sentinel) { throw 'буфер обміну змінився ще до введення пароля' }
    } -Expect $UI.EnterPassword

    Invoke-Step 'Невірний пароль: помилка, фокус лишається в полі' {
        Send-Text $Data.WrongPassword
        Send-Keys 'Enter'
        Wait-Until 'текст помилки' { Find-Element (Get-AppWindow) -Name $UI.WrongPassword }
        Wait-Until 'фокус знову в полі пароля' { Test-HasFocus (Find-Element (Get-AppWindow) -Id 'pwd-input') }
    } -ExpectCount @{ ($UI.WrongPassword) = 1 }

    Invoke-Step 'Правильний пароль копіює розшифрований текст' {
        Send-Keys 'Ctrl+A'
        Send-Text $Data.Password
        Send-Keys 'Enter'
        Wait-Until 'розшифрований текст у буфері обміну' { (Get-ClipText) -eq $Data.SecretText }
        Wait-Until 'вікно сховалось' { -not (Get-AppWindow) }
    } -Hope $UI.Copied

    # Settings dialog: what NVDA says on opening and at every Tab stop, in the visual
    # order, and that Escape brings back the theme and language without saving.
    $settingsFile = Join-Path $dataDir 'settings.json'
    $readSettings = { Get-Content -Raw -Encoding UTF8 $settingsFile | ConvertFrom-Json }
    $assertSaved = {
        param([string]$Theme, [string]$Language)
        $s = & $readSettings
        if ($s.theme -ne $Theme -or $s.language -ne $Language) {
            throw "у settings.json тема «$($s.theme)», мова «$($s.language)», а мали бути «$Theme» і «$Language»"
        }
    }
    $tabTo = {
        param([string]$Id, [string]$What)
        Send-Keys 'Tab'
        Wait-Until "фокус на «$What»" { & $hasFocus $Id }
    }

    Invoke-Step 'Ctrl+, відкриває налаштування: назва, версія, група, список «Тема»' {
        Show-App
        Send-Keys 'Ctrl+Comma'
        Wait-Until 'фокус у списку «Тема»' { & $hasFocus 'settings-theme' }
    } -Expect $UI.Settings, $UI.AppVersion, $UI.GroupAppearance, $UI.Theme, $UI.Dark -ExpectAny $Role.Dialog, $Role.Grouping, $Role.ComboBox

    Invoke-Step 'Tab: список «Мова»' {
        & $tabTo 'settings-lang' $UI.Language
    } -Expect $UI.Language, $UI.Ukrainian -ExpectAny $Role.ComboBox

    Invoke-Step 'Tab: прапорець «Запускати разом з Windows» з підказкою' {
        & $tabTo 'settings-autostart' $UI.Autostart
    } -Expect $UI.GroupStartup, $UI.Autostart, $UI.AutostartHint -ExpectAny $Role.Grouping, $Role.CheckBox, $Role.NotChecked

    Invoke-Step 'Tab: прапорець «Запускати згорнутим у трей» з підказкою' {
        & $tabTo 'settings-tray' $UI.StartInTray
    } -Expect $UI.StartInTray, $UI.StartInTrayHint -ExpectAny $Role.CheckBox, $Role.NotChecked

    Invoke-Step 'Tab: прапорець «Питати перед закриттям програми» з підказкою' {
        & $tabTo 'settings-confirm' $UI.ConfirmOnClose
    } -Expect $UI.ConfirmOnClose, $UI.ConfirmOnCloseHint -ExpectAny $Role.CheckBox, $Role.NotChecked

    Invoke-Step 'Tab: поле «Затримка між символами» зі значенням і підказкою' {
        & $tabTo 'settings-autotype-delay' $UI.AutotypeDelay
    } -Expect $UI.GroupAutotype, $UI.AutotypeDelay, '7', $UI.AutotypeDelayHint -ExpectAny $Role.SpinButton

    Invoke-Step 'Tab: «Скасувати», «Зберегти», а потім знову список «Тема»' {
        & $tabTo 'settings-cancel' $UI.Cancel
        & $tabTo 'settings-save' $UI.Save
        & $tabTo 'settings-theme' $UI.Theme
    } -Expect $UI.Cancel, $UI.Save, $UI.Theme -ExpectAny $Role.Button

    Invoke-Step 'Escape скасовує: тема й мова повертаються, нічого не записано' {
        # The theme list has focus. Down shows the light theme at once.
        Send-Keys 'Down'
        # Down in the language list shows the interface in German at once.
        & $tabTo 'settings-lang' $UI.Language
        Send-Keys 'Down'
        $null = Wait-Until 'діалог німецькою' { Find-Element (Get-AppWindow) -Name $UI.SettingsGerman }
        Send-Keys 'Esc'
        Wait-Until 'діалог закрито, фокус у головному вікні' {
            -not (Find-Element (Get-AppWindow) -Id 'settings-theme') -and (Test-AppReady)
        }
        & $assertSaved 'dark' 'uk'
    } -Expect $UI.Light, $UI.German -Forbid $UI.Saved

    Invoke-Step 'Знову Ctrl+,: діалог українською, тема темна' {
        Send-Keys 'Ctrl+Comma'
        Wait-Until 'фокус у списку «Тема»' { & $hasFocus 'settings-theme' }
        Send-Keys 'Esc'
        Wait-Until 'діалог закрито' { -not (Find-Element (Get-AppWindow) -Id 'settings-theme') -and (Test-AppReady) }
        & $assertSaved 'dark' 'uk'
    } -Expect $UI.Settings, $UI.Theme, $UI.Dark -Forbid $UI.SettingsGerman, $UI.Light

    # Keyboard shortcuts help: NVDA reads every row, keys and action, with the arrow keys
    # (the app root is role="application", so plain text would stay silent here).
    $helpItem = { param([int]$i) Find-Element (& $appWin) -Id "help-item-$i" }

    Invoke-Step 'F1 відкриває довідку: назва один раз, список, група, перший рядок' {
        Send-Keys 'F1'
        Wait-Until 'фокус на першому рядку довідки' { Test-HasFocus (& $helpItem 0) }
    } -Expect $UI.HelpGroupGlobal, 'Ctrl+Alt+Space', $HelpActions[0] -ExpectAny $Role.Dialog, $Role.List, $Role.Grouping -ExpectCount @{ ($UI.HelpTitle) = 1 }

    Invoke-Step 'Стрілка вниз читає кожен рядок довідки з дією і назви груп' {
        for ($i = 1; $i -lt $HelpActions.Count; $i++) {
            Send-Keys 'Down'
            Wait-Until "фокус на рядку довідки $($i + 1)" { Test-HasFocus (& $helpItem $i) }
        }
        # The last row: Down stays there.
        Send-Keys 'Down'
        if (-not (Test-HasFocus (& $helpItem ($HelpActions.Count - 1)))) { throw 'Стрілка вниз пішла далі останнього рядка' }
    } -Expect (@($UI.HelpGroupMain, $UI.HelpGroupDialogs, 'F1', 'Ctrl+кома', 'Ctrl+Enter') + $HelpActions[1..($HelpActions.Count - 1)])

    Invoke-Step 'Home повертає на перший рядок довідки' {
        Send-Keys 'Home'
        Wait-Until 'фокус на першому рядку довідки' { Test-HasFocus (& $helpItem 0) }
    } -Expect $HelpActions[0]

    Invoke-Step 'Tab: кнопка «Закрити»' {
        & $tabTo 'help-close' $UI.Close
    } -Expect $UI.Close -ExpectAny $Role.Button

    Invoke-Step 'Escape закриває довідку, фокус повертається в головне вікно' {
        Send-Keys 'Esc'
        Wait-Until 'довідку закрито, фокус у головному вікні' {
            -not (& $helpItem 0) -and (Test-AppReady)
        }
    } -Forbid $UI.HelpTitle

    Invoke-Step 'F1 у діалозі створення нічого не робить' {
        Send-Keys 'Ctrl+N'
        Wait-Until 'фокус у полі «Назва»' { & $hasFocus 'create-title' }
        Send-Keys 'F1'
        Start-Sleep -Milliseconds 600
        if (& $helpItem 0) { throw 'F1 відкрила довідку поверх діалогу створення' }
        if (-not (& $hasFocus 'create-title')) { throw 'після F1 фокус пішов з поля «Назва»' }
        Send-Keys 'Esc'
        Wait-Until 'діалог створення закрито' { -not (Find-Element (& $appWin) -Id 'create-title') -and (Test-AppReady) }
    } -Expect $UI.CreateTitle -Forbid $UI.HelpTitle

    $autostartSkip = ''
    if ($UserRunValue) { $autostartSkip = 'у вас увімкнено автозапуск QuickSnippets, тест його не чіпає' }

    Invoke-Step 'Автозапуск вмикається в налаштуваннях' {
        Show-App
        Send-Keys 'Ctrl+Comma'
        $box = Wait-Until 'налаштування відкрито' { Find-Element (Get-AppWindow) -Id 'settings-autostart' }
        Set-Toggle $box $true
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'запис автозапуску в реєстрі' {
            $v = Get-RunValue
            $v -and $v.IndexOf($TestExe, [StringComparison]::OrdinalIgnoreCase) -ge 0
        }
        # What the next start reads: the new value, and the other settings unchanged.
        $null = Wait-Until 'автозапуск у settings.json' { (& $readSettings).autostart -eq $true } 3
        & $assertSaved 'dark' 'uk'
        if ((& $readSettings).autotype_delay_ms -ne 7) { throw 'збереження змінило затримку автодруку' }
    } -Expect $UI.Settings -SkipReason $autostartSkip

    Invoke-Step 'Автозапуск вимикається' {
        Send-Keys 'Ctrl+Alt+Space'
        $null = Wait-Until 'вікно програми' { Get-AppWindow }
        Send-Keys 'Ctrl+Comma'
        $box = Wait-Until 'налаштування відкрито' { Find-Element (Get-AppWindow) -Id 'settings-autostart' }
        Set-Toggle $box $false
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'запис автозапуску зник' { -not (Get-RunValue) }
        $null = Wait-Until 'автозапуск вимкнено в settings.json' { (& $readSettings).autostart -eq $false } 3
    } -SkipReason $autostartSkip
}
finally {
    Stop-Target
    if ($script:AppProc -and -not $script:AppProc.HasExited) {
        Stop-Process -Id $script:AppProc.Id -Force -ErrorAction SilentlyContinue
        $null = $script:AppProc.WaitForExit(5000)
    }
    $v = Get-RunValue
    if ($v -and $v.IndexOf($TestExe, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Remove-ItemProperty -Path $RunKey -Name 'QuickSnippets' -ErrorAction SilentlyContinue
    }
    if ($null -ne $ClipBackup) { Set-ClipText $ClipBackup }
    elseif ($IsSta) { [System.Windows.Forms.Clipboard]::Clear() }
    for ($i = 0; $i -lt 10 -and (Test-Path $Work); $i++) {
        try { Remove-Item $Work -Recurse -Force } catch { Start-Sleep -Milliseconds 500 }
    }
}

# ── Report ───────────────────────────────────────────────────────────────────
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add(('Звіт перевірки QuickSnippets з NVDA, {0:dd.MM.yyyy HH:mm}' -f (Get-Date)))
$lines.Add(('Exe: {0}, зібрано {1:dd.MM.yyyy HH:mm}' -f $Exe, $exeTime))
if ($script:LogPath) { $lines.Add("Лог NVDA: $script:LogPath") } else { $lines.Add('NVDA: мовлення не перевірялось') }
if ($script:SetupError) { $lines.Add("Підготовка: ПОМИЛКА ($script:SetupError)") }
foreach ($note in $Notes) { $lines.Add("Увага: $note") }
$lines.Add('')

$appOk = 0; $appFail = 0; $skipped = 0; $nvdaOk = 0; $nvdaAll = 0; $anySpeech = $false
foreach ($r in $Results) {
    $line = 'Крок {0}. {1}: {2}' -f $r.N, $r.Title, $r.Status
    if ($r.Detail) { $line += " ($($r.Detail))" }
    $lines.Add($line)
    switch ($r.Status) { 'OK' { $appOk++ } 'ПОМИЛКА' { $appFail++ } default { $skipped++ } }
    if ($r.Speech.Count) {
        $anySpeech = $true
        $said = $r.Speech -join ' | '
        if ($said.Length -gt 500) { $said = $said.Substring(0, 500) + '…' }
        $lines.Add("  NVDA сказав: $said")
    } elseif ($script:LogPath -and $r.Status -ne 'ПРОПУЩЕНО') {
        $lines.Add('  NVDA нічого не сказав')
    }
    foreach ($c in $r.Checks) {
        if ($c.Required) {
            $nvdaAll++
            if ($c.Ok) { $nvdaOk++ }
            $lines.Add(('  NVDA: {0}: {1}' -f $c.Text, $(if ($c.Ok) { 'OK' } else { 'ПОМИЛКА' })))
        } else {
            $lines.Add(('  NVDA: {0}: {1}' -f $c.Text, $(if ($c.Ok) { 'так' } else { 'ні (не помилка)' })))
        }
    }
}
$lines.Add('')
$summary = 'Підсумок: кроків OK {0}, з помилкою {1}, пропущено {2}' -f $appOk, $appFail, $skipped
if ($script:LogPath) { $summary += '; перевірок NVDA OK {0} з {1}' -f $nvdaOk, $nvdaAll }
$lines.Add($summary + '.')
if ($script:LogPath -and -not $anySpeech -and ($appOk + $appFail) -gt 0) {
    $lines.Add('NVDA нічого не записав у лог. Рівень журналювання NVDA має бути «введення/виведення».')
}
if ($script:NvdaErrors.Count) {
    $lines.Add("Помилки в лозі NVDA під час тесту: $($script:NvdaErrors.Count). Перша: $($script:NvdaErrors[0])")
}
# Hints and the app version in Settings reach NVDA as object descriptions.
$descriptionTexts = @($UI.AppVersion, $UI.AutostartHint, $UI.StartInTrayHint, $UI.ConfirmOnCloseHint, $UI.AutotypeDelayHint)
$missedDescription = $false
foreach ($r in $Results) {
    foreach ($c in $r.Checks) {
        if (-not $c.Required -or $c.Ok) { continue }
        foreach ($d in $descriptionTexts) { if ($c.Text.Contains($d)) { $missedDescription = $true } }
    }
}
if ($missedDescription) {
    # Double quotes: PowerShell takes the Ukrainian apostrophe (U+2019) for a single quote.
    $lines.Add("NVDA не прочитав підказки чи версію в налаштуваннях: вони є описами об’єктів. Перевірте, що в NVDA увімкнено «Читати опис об’єкта» (Параметри, Налаштування, Представлення об’єкта).")
}
if (-not $ClipHadText) { $lines.Add('У буфері обміну до тесту був не текст, його не відновлено.') }
if ($UserApps.Count) { $lines.Add('Вашу копію QuickSnippets закрито для тесту.') }

[IO.File]::WriteAllLines($ReportPath, $lines, (New-Object Text.UTF8Encoding $true))
$lines | ForEach-Object { Write-Host $_ }
Write-Host "Звіт збережено: $ReportPath"
Write-Host 'Готово.'

if ($script:SetupError -or $appFail -gt 0 -or $nvdaOk -ne $nvdaAll) { exit 1 } else { exit 0 }
