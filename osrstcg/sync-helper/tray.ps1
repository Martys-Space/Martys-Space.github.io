# OSRS TCG Locked Tracker - sync helper tray launcher.
#
# Starts OSRS-TCG-Sync-Helper.exe completely hidden (no console window) and
# shows a small icon in the Windows system tray so you can tell it's running
# and close it with a right-click -> Exit, instead of leaving a terminal
# window open on your desktop.
#
# You don't need to run this directly - double-click Run-in-Background.bat
# in this same folder instead.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exePath = Join-Path $scriptDir 'OSRS-TCG-Sync-Helper.exe'

if (-not (Test-Path $exePath)) {
    [System.Windows.Forms.MessageBox]::Show(
        "Can't find OSRS-TCG-Sync-Helper.exe next to this script. Make sure you unzipped everything into the same folder.",
        'OSRS TCG Sync Helper',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

# The .exe is a normal console program, but WindowStyle Hidden here keeps it
# (and its console window) from ever being shown - it just runs silently in
# the background, same server, same behavior, just no visible window.
$helperProcess = Start-Process -FilePath $exePath -WindowStyle Hidden -PassThru

$trayIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon.Icon = [System.Drawing.SystemIcons]::Application
$trayIcon.Text = 'OSRS TCG Sync Helper (running)'
$trayIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$statusItem = $menu.Items.Add('OSRS TCG Sync Helper - running')
$statusItem.Enabled = $false

$menu.Items.Add('-') | Out-Null

$healthItem = $menu.Items.Add('Check status in browser')
$healthItem.Add_Click({ Start-Process 'http://127.0.0.1:51823/health' })

$exitItem = $menu.Items.Add('Exit')
$exitItem.Add_Click({
    if ($helperProcess -and -not $helperProcess.HasExited) {
        Stop-Process -Id $helperProcess.Id -Force -ErrorAction SilentlyContinue
    }
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$trayIcon.ContextMenuStrip = $menu
$trayIcon.Add_DoubleClick({ Start-Process 'http://127.0.0.1:51823/health' })

$trayIcon.ShowBalloonTip(3000, 'OSRS TCG Sync Helper', 'Running in the background - right-click the tray icon to exit.', [System.Windows.Forms.ToolTipIcon]::Info)

[System.Windows.Forms.Application]::Run()
