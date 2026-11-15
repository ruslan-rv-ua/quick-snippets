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
         Comma = 0xBC; Down = 0x28; Up = 0x26; Home = 0x24; End = 0x23; Delete = 0x2E }
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
# ExpectCount - must be said exactly N times, e.g. @{ 'Збережено' = 2 }
# Forbid      - must not be said
# Hope        - nice to hear, reported but never a failure (speech that races with the window hiding)
function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action,
        [string[]]$Expect = @(),
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

    if ($script:LogPath -and $r.Status -eq 'OK' -and ($Expect.Count -or $ExpectCount.Count)) {
        # NVDA can lag behind the app: wait until it has said what we expect.
        $deadline = (Get-Date).AddSeconds($SpeechWaitSec)
        do {
            $said = Get-SaidText (Get-StepSpeech $from)
            $done = $true
            foreach ($p in $Expect) { if ((Get-Count $said $p) -lt 1) { $done = $false } }
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
        autotype_delay_ms = 1; sort_mode = 'modified'; sort_direction = 'desc'
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
    } -Expect $UI.Settings -SkipReason $autostartSkip

    Invoke-Step 'Автозапуск вимикається' {
        Send-Keys 'Ctrl+Alt+Space'
        $null = Wait-Until 'вікно програми' { Get-AppWindow }
        Send-Keys 'Ctrl+Comma'
        $box = Wait-Until 'налаштування відкрито' { Find-Element (Get-AppWindow) -Id 'settings-autostart' }
        Set-Toggle $box $false
        Send-Keys 'Ctrl+Enter'
        Wait-Until 'запис автозапуску зник' { -not (Get-RunValue) }
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
if (-not $ClipHadText) { $lines.Add('У буфері обміну до тесту був не текст, його не відновлено.') }
if ($UserApps.Count) { $lines.Add('Вашу копію QuickSnippets закрито для тесту.') }

[IO.File]::WriteAllLines($ReportPath, $lines, (New-Object Text.UTF8Encoding $true))
$lines | ForEach-Object { Write-Host $_ }
Write-Host "Звіт збережено: $ReportPath"
Write-Host 'Готово.'

if ($script:SetupError -or $appFail -gt 0 -or $nvdaOk -ne $nvdaAll) { exit 1 } else { exit 0 }
