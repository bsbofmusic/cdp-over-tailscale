$ErrorActionPreference = 'SilentlyContinue'

$processNames = @('CDP Bridge', 'electron')
foreach ($processName in $processNames) {
  Get-Process -Name $processName | Stop-Process -Force
}

$pathsToRemove = @(
  "$env:APPDATA\cdp-bridge-dev",
  "$env:LOCALAPPDATA\cdp-bridge-updater",
  "D:\CODE\cdp-bridge\test-install"
)

foreach ($targetPath in $pathsToRemove) {
  if (Test-Path $targetPath) {
    Remove-Item -Recurse -Force $targetPath
  }
}

Write-Host 'Clean install prep complete.'
Write-Host 'You can now run the latest installer safely.'
