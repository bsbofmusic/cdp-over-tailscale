const { execFileSync } = require('node:child_process');

function runPowerShell(script) {
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    return `ERROR:\n${error.stderr || error.message}`;
  }
}

const sections = [
  {
    title: 'PROCESSES',
    script: "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'CDP Bridge.exe' -or $_.Name -eq 'electron.exe' }; $procs | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Depth 4"
  },
  {
    title: 'SHORTCUTS',
    script: "$desktop=[Environment]::GetFolderPath('Desktop'); $start=Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'; Get-ChildItem -Path @($desktop,$start) -Recurse -Filter '*CDP Bridge*.lnk' -ErrorAction SilentlyContinue | Select-Object FullName,LastWriteTime | ConvertTo-Json -Depth 4"
  },
  {
    title: 'INSTALL_DIRS',
    script: "Get-ChildItem -Path @($env:LOCALAPPDATA,$env:APPDATA) -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*CDP Bridge*' -or $_.FullName -like '*cdp-bridge*' } | Select-Object FullName | ConvertTo-Json -Depth 4"
  }
];

for (const section of sections) {
  console.log(`---${section.title}---`);
  console.log(runPowerShell(section.script) || '[]');
}
