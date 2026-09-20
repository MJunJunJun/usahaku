# This script self-elevates once when launched by start.cmd. It blocks
# network-originated access to native GoWA; the launcher also binds GoWA to
# 127.0.0.1 so the backend can still use it locally.
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait -ArgumentList $arguments
    exit $LASTEXITCODE
}

$ruleName = "Situska - Block public GoWA"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Set-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Block -Profile Any -Enabled True
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Block -Protocol TCP -LocalPort 3001 -Profile Any -Enabled True -EdgeTraversalPolicy Block | Out-Null
}

Get-NetFirewallRule -DisplayName $ruleName | Get-NetFirewallPortFilter |
    Select-Object Protocol, LocalPort
