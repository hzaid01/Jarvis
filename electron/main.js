const { app, BrowserWindow, ipcMain, dialog, shell, desktopCapturer, powerSaveBlocker } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const { execFile, exec, spawn, execSync } = require('child_process');
const os = require('os');
const memory = require('./memoryService');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#020810',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      v8CacheOptions: 'bypassHeatCheck',
    },
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [Level ${level}] ${message} (at ${sourceId}:${line})`);
  });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() || false);

// ============================================================
// SYSTEM TIME — Real local time
// ============================================================
ipcMain.handle('get-system-time', () => {
  return {
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
});

// ============================================================
// LOCATION — IP-based, cached 1 hour
// ============================================================
let cachedLocation = null;
let lastLocationFetch = 0;

ipcMain.handle('get-location', async () => {
  const now = Date.now();
  if (cachedLocation && (now - lastLocationFetch) < 3600000) return cachedLocation;
  try {
    const http = require('http');
    const data = await new Promise((resolve, reject) => {
      http.get('http://ip-api.com/json/', (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
        });
      }).on('error', reject);
    });
    cachedLocation = {
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
      region: data.regionName || '',
      lat: data.lat || 0,
      lon: data.lon || 0,
      timezone: data.timezone || '',
    };
    lastLocationFetch = now;
    return cachedLocation;
  } catch (e) {
    console.error('Location fetch failed:', e.message);
    return cachedLocation || { city: 'Unknown', country: 'Unknown', region: '', lat: 0, lon: 0, timezone: '' };
  }
});

// ============================================================
// STATS WORKER THREAD & BLOCKERS
// ============================================================
let statsWorker = null;
let latestStats = null;

function startStatsWorker() {
  if (statsWorker) {
    try { statsWorker.terminate(); } catch (e) {}
  }
  statsWorker = new Worker(path.join(__dirname, 'workers/statsWorker.js'));
  statsWorker.on('message', (data) => {
    latestStats = data;
  });
  statsWorker.on('error', (err) => {
    console.error('Stats worker error:', err);
    if (!appQuitting) {
      setTimeout(startStatsWorker, 5000);
    }
  });
  statsWorker.on('exit', (code) => {
    console.log(`Stats worker exited with code ${code}`);
    if (code !== 0 && !appQuitting) {
      setTimeout(startStatsWorker, 5000);
    }
  });
}

ipcMain.handle('get-system-stats', async () => {
  return latestStats;
});

let activeBlockerId = null;
let blockerTimeout = null;

ipcMain.on('ai-started', () => {
  if (activeBlockerId === null) {
    activeBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    console.log('[main] Power save blocker started, ID:', activeBlockerId);
  }
  if (blockerTimeout) {
    clearTimeout(blockerTimeout);
  }
  blockerTimeout = setTimeout(() => {
    if (activeBlockerId !== null && powerSaveBlocker.isStarted(activeBlockerId)) {
      powerSaveBlocker.stop(activeBlockerId);
      console.log('[main] Power save blocker stopped (timeout 60s), ID:', activeBlockerId);
      activeBlockerId = null;
    }
    blockerTimeout = null;
  }, 60000);
});

ipcMain.on('ai-stopped', () => {
  if (blockerTimeout) {
    clearTimeout(blockerTimeout);
    blockerTimeout = null;
  }
  if (activeBlockerId !== null && powerSaveBlocker.isStarted(activeBlockerId)) {
    powerSaveBlocker.stop(activeBlockerId);
    console.log('[main] Power save blocker stopped (ai-stopped), ID:', activeBlockerId);
    activeBlockerId = null;
  }
});

// ============================================================
// MEMORY SYSTEM IPC HANDLERS
// ============================================================
ipcMain.handle('memory-build-prompt', async (_event, message) => {
  try {
    return memory.buildSystemPrompt(message, cachedLocation);
  } catch (err) {
    console.error('memory-build-prompt error:', err.message);
    return null;
  }
});

ipcMain.handle('memory-save-turn', async (_event, userMsg, aiResponse) => {
  try {
    memory.autoExtractAndSave(memory.getCurrentSessionId(), userMsg, aiResponse);
    return true;
  } catch (err) {
    console.error('memory-save-turn error:', err.message);
    return false;
  }
});

ipcMain.handle('memory-get-all', async () => {
  try {
    return memory.getAllObservations();
  } catch (err) {
    return [];
  }
});

ipcMain.handle('memory-get-profile', async () => {
  try {
    return memory.getUserProfile();
  } catch (err) {
    return {};
  }
});

ipcMain.handle('memory-get-sessions', async () => {
  try {
    return memory.getRecentSessions(50);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('memory-delete', async (_event, id) => {
  try {
    memory.deleteObservation(id);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('memory-search', async (_event, query) => {
  try {
    return memory.searchObservations(query);
  } catch (err) {
    return [];
  }
});

// ============================================================
// PC CONTROL — Tool Execution System
// ============================================================

// Dangerous command patterns that require user confirmation
const DANGEROUS_PS_PATTERNS = [
  /Remove-Item/i, /del\s/i, /rm\s/i, /rmdir/i,
  /Stop-Process/i, /taskkill/i, /kill/i,
  /shutdown/i, /restart/i, /Restart-Computer/i, /Stop-Computer/i,
  /Format-/i, /Clear-Disk/i, /Clear-RecycleBin/i,
  /Set-ExecutionPolicy/i,
  /reg\s+delete/i, /reg\s+add/i,
  /New-Service/i, /Remove-Service/i,
  /Disable-NetAdapter/i,
];

function isDangerousCommand(command) {
  return DANGEROUS_PS_PATTERNS.some(pattern => pattern.test(command));
}

async function confirmAction(message) {
  if (!mainWindow) return false;
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Confirm'],
    defaultId: 0,
    cancelId: 0,
    title: 'JARVIS — Action Confirmation',
    message: '⚠ Destructive Action Detected',
    detail: message,
  });
  return result.response === 1;
}

function runPowerShell(command, timeout = 15000) {
  return new Promise((resolve) => {
    const escaped = command.replace(/"/g, '\\"');
    const fullCmd = 'powershell -NoProfile -Command "' + escaped + '"';
    exec(fullCmd,
      { timeout, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message, output: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout.trim() || 'Command executed successfully.' });
        }
      }
    );
  });
}

// Tool handler map — each returns { success, output/error }
const TOOL_HANDLERS = {
  open_app: async (params) => {
    const name = (params.app_name || params.name || '').toLowerCase().trim();
    if (!name) return { success: false, error: 'No app name provided' };
    const APP_COMMANDS = {
      'chrome': 'start chrome', 'google chrome': 'start chrome',
      'firefox': 'start firefox', 'brave': 'start brave',
      'edge': 'start msedge', 'microsoft edge': 'start msedge',
      'notepad': 'start notepad', 'calculator': 'start calc', 'calc': 'start calc',
      'microsoft store': 'start ms-windows-store:', 'store': 'start ms-windows-store:',
      'spotify': 'start spotify:', 'discord': 'start discord:',
      'file explorer': 'start explorer', 'explorer': 'start explorer',
      'task manager': 'start taskmgr', 'taskmgr': 'start taskmgr',
      'settings': 'start ms-settings:', 'windows settings': 'start ms-settings:',
      'camera': 'start microsoft.windows.camera:',
      'paint': 'start mspaint', 'mspaint': 'start mspaint',
      'word': 'start winword', 'microsoft word': 'start winword',
      'excel': 'start excel', 'microsoft excel': 'start excel',
      'powerpoint': 'start powerpnt', 'ppt': 'start powerpnt',
      'vs code': 'code .', 'vscode': 'code .', 'visual studio code': 'code .',
      'terminal': 'start wt', 'windows terminal': 'start wt',
      'cmd': 'start cmd', 'command prompt': 'start cmd',
      'powershell': 'start powershell',
      'snipping tool': 'start snippingtool', 'snip': 'start snippingtool',
      'photos': 'start ms-photos:',
      'clock': 'start ms-clock:',
      'maps': 'start bingmaps:',
      'mail': 'start outlookmail:',
      'calendar': 'start outlookcal:',
    };
    const command = APP_COMMANDS[name] || `start "" "${name}"`;
    return new Promise((resolve) => {
      exec(`cmd /c ${command}`, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: `Failed to open ${name}: ${error.message}` });
        } else {
          resolve({ success: true, output: `Opened ${name}` });
        }
      });
    });
  },

  open_url: async (params) => {
    const url = params.url || '';
    if (!url) return { success: false, error: 'No URL provided' };
    try {
      await shell.openExternal(url.startsWith('http') ? url : `https://${url}`);
      return { success: true, output: `Opened ${url}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  web_search: async (params) => {
    const query = params.query || '';
    if (!query) return { success: false, error: 'No search query' };
    try {
      // Load Tavily API key from .env
      const envPath = path.join(__dirname, '../.env');
      let tavilyKey = process.env.TAVILY_API_KEY || '';
      if (!tavilyKey) {
        try {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const match = envContent.match(/^TAVILY_API_KEY\s*=\s*(.+)$/m);
          if (match) tavilyKey = match[1].trim().replace(/^["']|["']$/g, '');
        } catch (_) {}
      }
      if (!tavilyKey) return { success: false, error: 'TAVILY_API_KEY not found in .env file' };

      const https = require('https');
      const postData = JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      });

      const result = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.tavily.com',
          path: '/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tavilyKey}`,
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 15000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Invalid response from Tavily API'));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Tavily API request timed out')); });
        req.write(postData);
        req.end();
      });

      // Format results as clean LLM context
      let contextParts = [];
      if (result.answer) {
        contextParts.push(`[Tavily Answer]\n${result.answer}`);
      }
      const results = (result.results || []).slice(0, 5);
      if (results.length > 0) {
        results.forEach((r, i) => {
          contextParts.push(`[${i + 1}] ${r.title || 'No title'}\nURL: ${r.url || ''}\n${r.content || ''}`);
        });
      }
      const output = contextParts.length > 0
        ? contextParts.join('\n\n')
        : 'No relevant results found.';

      return { success: true, output };
    } catch (e) {
      return { success: false, error: `Search failed: ${e.message}` };
    }
  },

  take_screenshot: async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'], thumbnailSize: { width: 1920, height: 1080 }
      });
      if (sources.length === 0) return { success: false, error: 'No screen found' };
      const img = sources[0].thumbnail.toPNG();
      const savePath = path.join(os.homedir(), 'Desktop', `screenshot_${Date.now()}.png`);
      fs.writeFileSync(savePath, img);
      return { success: true, output: `Screenshot saved to ${savePath}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  volume_control: async (params) => {
    const action = (params.action || 'set').toLowerCase();
    const value = parseInt(params.value) || 50;
    const nircmdPath = path.join(__dirname, 'nircmd', 'nircmd.exe');
    return new Promise((resolve) => {
      let args;
      if (action === 'mute' || action === 'unmute' || action === 'toggle') {
        args = ['mutesysvolume', '2'];
      } else if (action === 'up') {
        args = ['changesysvolume', '5000'];
      } else if (action === 'down') {
        args = ['changesysvolume', '-5000'];
      } else {
        // set to specific level (0-100)
        const nircmdLevel = Math.round(Math.min(100, Math.max(0, value)) * 655.35);
        args = ['setsysvolume', String(nircmdLevel)];
      }
      execFile(nircmdPath, args, (error) => {
        if (error) {
          resolve({ success: false, error: `Volume control failed: ${error.message}` });
        } else {
          resolve({ success: true, output: `Volume ${action}: ${action === 'set' ? value + '%' : 'done'}` });
        }
      });
    });
  },

  brightness_control: async (params) => {
    const action = (params.action || 'set').toLowerCase();
    const value = parseInt(params.value) || 50;
    if (action === 'set') {
      return runPowerShell('(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,' + value + ')');
    } else if (action === 'up') {
      return runPowerShell('$b = (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness; (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,[math]::Min(100,$b+10))');
    } else {
      return runPowerShell('$b = (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness; (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,[math]::Max(0,$b-10))');
    }
  },

  file_control: async (params) => {
    const action = (params.action || '').toLowerCase();
    const fp = (params.path || '').replace(/[$]USER/g, os.userInfo().username);

    if (action === 'delete') {
      const confirmed = await confirmAction('Delete: ' + fp + '\n\nThis cannot be undone.');
      if (!confirmed) return { success: false, output: 'Action cancelled by user.' };
      return runPowerShell('Remove-Item -Path "' + fp + '" -Recurse -Force');
    }
    if (action === 'list') return runPowerShell('Get-ChildItem -Path "' + (fp || '.') + '" | Format-Table Name, Length, LastWriteTime -AutoSize | Out-String -Width 200');
    if (action === 'read') return runPowerShell('Get-Content -Path "' + fp + '" -TotalCount 100 | Out-String');
    if (action === 'write') return runPowerShell('Set-Content -Path "' + fp + '" -Value \'' + (params.content || '').replace(/'/g, "''") + '\'');
    if (action === 'move') return runPowerShell('Move-Item -Path "' + fp + '" -Destination "' + params.destination + '"');
    if (action === 'copy') return runPowerShell('Copy-Item -Path "' + fp + '" -Destination "' + params.destination + '" -Recurse');
    if (action === 'create_folder') return runPowerShell('New-Item -Path "' + fp + '" -ItemType Directory -Force');
    if (action === 'find') return runPowerShell('Get-ChildItem -Path "' + (fp || 'C:\\Users') + '" -Recurse -Filter "' + (params.name || '*') + '" -ErrorAction SilentlyContinue | Select-Object -First 20 FullName | Out-String');
    return { success: false, error: 'Unknown file action: ' + action };
  },

  run_powershell: async (params) => {
    const command = params.command || '';
    if (!command) return { success: false, error: 'No command provided' };
    if (isDangerousCommand(command)) {
      const confirmed = await confirmAction('Execute potentially dangerous command:\n\n' + command);
      if (!confirmed) return { success: false, output: 'Action cancelled by user.' };
    }
    return runPowerShell(command, 30000);
  },

  get_system_info: async (params) => {
    const type = (params.type || 'processes').toLowerCase();
    const cmds = {
      processes: "Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 15 Name, Id, @{N='CPU(s)';E={[math]::Round($_.CPU,1)}}, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet/1MB,1)}} | Format-Table -AutoSize | Out-String -Width 200",
      cpu: 'Get-CimInstance Win32_Processor | Select Name, NumberOfCores, MaxClockSpeed, LoadPercentage | Format-List | Out-String',
      memory: '$os = Get-CimInstance Win32_OperatingSystem; "Total: {0:N0} MB`nFree: {1:N0} MB`nUsed: {2:N0} MB`nUsage: {3:N0}%" -f ($os.TotalVisibleMemorySize/1KB), ($os.FreePhysicalMemory/1KB), (($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/1KB), ((($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/$os.TotalVisibleMemorySize)*100)',
      disk: "Get-PSDrive -PSProvider FileSystem | Select Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}} | Format-Table -AutoSize | Out-String",
      network: "Get-NetIPAddress -AddressFamily IPv4 | Where { $_.IPAddress -ne '127.0.0.1' } | Select IPAddress, InterfaceAlias | Format-Table -AutoSize | Out-String",
      battery: 'Get-CimInstance Win32_Battery | Select EstimatedChargeRemaining, BatteryStatus | Format-List | Out-String',
      uptime: '$boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime; $up = (Get-Date) - $boot; "{0} days, {1} hours, {2} minutes" -f $up.Days, $up.Hours, $up.Minutes',
    };
    return runPowerShell(cmds[type] || cmds.processes);
  },

  close_app: async (params) => {
    const name = params.name || '';
    if (!name) return { success: false, error: 'No app name' };
    const confirmed = await confirmAction(`Close application: ${name}`);
    if (!confirmed) return { success: false, output: 'Action cancelled by user.' };
    return runPowerShell(`Stop-Process -Name "${name}" -Force -ErrorAction SilentlyContinue`);
  },

  system_power: async (params) => {
    const action = (params.action || '').toLowerCase();
    const msgs = { shutdown: 'Shut down', restart: 'Restart', sleep: 'Put to sleep', lock: 'Lock' };
    if (!msgs[action]) return { success: false, error: `Unknown power action: ${action}` };
    if (action !== 'lock') {
      const confirmed = await confirmAction(`${msgs[action]} the computer?`);
      if (!confirmed) return { success: false, output: 'Action cancelled by user.' };
    }
    const cmds = {
      shutdown: 'Stop-Computer -Force',
      restart: 'Restart-Computer -Force',
      sleep: 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Suspend",$false,$false)',
      lock: 'rundll32.exe user32.dll,LockWorkStation',
    };
    return runPowerShell(cmds[action]);
  },

  open_folder: async (params) => {
    const folderPath = params.path || path.join(os.homedir(), 'Desktop');
    return runPowerShell(`explorer.exe "${folderPath}"`);
  },

  search_files: async (params) => {
    const query = params.query || '*';
    const searchPath = (params.path || os.homedir()).replace(/[$]USER/g, os.userInfo().username);
    const ext = params.extension || '';
    const filter = ext ? `*${ext}` : `*${query}*`;
    return runPowerShell(`Get-ChildItem -Path "${searchPath}" -Recurse -Filter "${filter}" -ErrorAction SilentlyContinue | Select-Object -First 25 FullName, Length, LastWriteTime | Format-Table -AutoSize | Out-String -Width 300`, 30000);
  },
};

// Main IPC handler for tool execution
ipcMain.handle('execute-tool', async (_event, toolName, params) => {
  const handler = TOOL_HANDLERS[toolName];
  if (!handler) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
  try {
    console.log(`[TOOL] Executing: ${toolName}`, params);
    const result = await handler(params || {});
    console.log(`[TOOL] ${toolName} → ${result.success ? 'OK' : 'FAIL'}`);
    return result;
  } catch (e) {
    console.error(`[TOOL] ${toolName} error:`, e.message);
    return { success: false, error: e.message };
  }
});

// ============================================================
// CHAT LOG PERSISTENCE — JSON-based message history
// ============================================================
const CHAT_LOG_DIR = path.join(app.getPath('userData'), 'jarvis');
const CHAT_LOG_PATH = path.join(CHAT_LOG_DIR, 'jarvis_chatlog.json');

ipcMain.handle('save-chat-log', async (_event, messages) => {
  try {
    if (!fs.existsSync(CHAT_LOG_DIR)) fs.mkdirSync(CHAT_LOG_DIR, { recursive: true });
    const toSave = (messages || []).slice(-50);
    fs.writeFileSync(CHAT_LOG_PATH, JSON.stringify(toSave, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save chat log:', e.message);
    return false;
  }
});

ipcMain.handle('load-chat-log', async () => {
  try {
    if (fs.existsSync(CHAT_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(CHAT_LOG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load chat log:', e.message);
  }
  return [];
});

ipcMain.handle('clear-chat-log', async () => {
  try {
    if (fs.existsSync(CHAT_LOG_PATH)) fs.unlinkSync(CHAT_LOG_PATH);
    return true;
  } catch (e) {
    console.error('Failed to clear chat log:', e.message);
    return false;
  }
});

ipcMain.handle('get-chat-log-size', async () => {
  try {
    if (fs.existsSync(CHAT_LOG_PATH)) {
      const stats = fs.statSync(CHAT_LOG_PATH);
      return (stats.size / 1024).toFixed(1); // KB
    }
  } catch {}
  return '0';
});

// ============================================================
// VOLUME CONTROL — nircmd direct IPC handlers
// ============================================================
const nircmdPath = path.join(__dirname, 'nircmd', 'nircmd.exe');

ipcMain.handle('volume-up', () => {
  return new Promise((resolve) => {
    execFile(nircmdPath, ['changesysvolume', '5000'], (err) => {
      resolve(err ? { success: false, error: err.message } : { success: true });
    });
  });
});

ipcMain.handle('volume-down', () => {
  return new Promise((resolve) => {
    execFile(nircmdPath, ['changesysvolume', '-5000'], (err) => {
      resolve(err ? { success: false, error: err.message } : { success: true });
    });
  });
});

ipcMain.handle('volume-mute', () => {
  return new Promise((resolve) => {
    execFile(nircmdPath, ['mutesysvolume', '2'], (err) => {
      resolve(err ? { success: false, error: err.message } : { success: true });
    });
  });
});

ipcMain.handle('set-volume', (_event, level) => {
  const nircmdLevel = Math.round(Math.min(100, Math.max(0, level)) * 655.35);
  return new Promise((resolve) => {
    execFile(nircmdPath, ['setsysvolume', String(nircmdLevel)], (err) => {
      resolve(err ? { success: false, error: err.message } : { success: true });
    });
  });
});

// ============================================================
// VOICE CAPABILITIES (RealtimeSTT)
// ============================================================
let voiceServer = null;
let appQuitting = false;

function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      // /T = kill child processes, /F = force
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch (e) {
    // Process may have already exited
    try { proc.kill(); } catch (_) {}
  }
}

function getPythonPath() {
  const isWin = process.platform === 'win32';
  
  // 1. Check if configured in .env
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^PYTHON_PATH\s*=\s*(.+)$/m);
      if (match) {
        const pPath = match[1].trim().replace(/^["']|["']$/g, '');
        if (fs.existsSync(pPath)) {
          console.log('[Python Resolver] Found PYTHON_PATH in .env:', pPath);
          return pPath;
        }
      }
    } catch (_) {}
  }

  // 2. Check if configured in .vscode/settings.json
  const vscodeSettingsPath = path.join(__dirname, '../.vscode/settings.json');
  if (fs.existsSync(vscodeSettingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(vscodeSettingsPath, 'utf-8'));
      const interpreterPath = settings['python.defaultInterpreterPath'] || settings['python.interpreterPath'];
      if (interpreterPath) {
        let resolvedPath = interpreterPath;
        resolvedPath = resolvedPath.replace(/\${workspaceFolder}/g, path.join(__dirname, '..'));
        if (resolvedPath.startsWith('.')) {
          resolvedPath = path.resolve(__dirname, '..', resolvedPath);
        }
        if (fs.existsSync(resolvedPath)) {
          console.log('[Python Resolver] Found VS Code selected interpreter:', resolvedPath);
          return resolvedPath;
        }
      }
    } catch (_) {}
  }

  // 3. Check for virtual environment in the workspace (.venv or venv)
  const venvPaths = [
    isWin ? '../.venv/Scripts/python.exe' : '../.venv/bin/python',
    isWin ? '../venv/Scripts/python.exe' : '../venv/bin/python',
  ];
  for (const vp of venvPaths) {
    const fullVp = path.resolve(__dirname, vp);
    if (fs.existsSync(fullVp)) {
      console.log('[Python Resolver] Found workspace virtual environment:', fullVp);
      return fullVp;
    }
  }

  // 4. Default fallback
  const fallback = isWin ? 'python' : 'python3';
  console.log('[Python Resolver] Using system fallback:', fallback);
  return fallback;
}

function startVoiceServer() {
  const scriptPath = path.join(__dirname, '../voice_server.py');
  const pythonPath = getPythonPath();

  console.log('Starting voice server:', scriptPath);
  console.log('Python path:', pythonPath);

  try {
    voiceServer = spawn(pythonPath, [scriptPath], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        HF_HUB_DISABLE_TELEMETRY: '1',
        HF_HUB_DISABLE_PROGRESS_BARS: '1',
        TRANSFORMERS_VERBOSITY: 'error',
        TOKENIZERS_PARALLELISM: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    voiceServer.on('error', (err) => {
      console.error('[Voice Server] Spawn error:', err.message);
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('voice-status', `error: ${err.message}`);
      }
    });

    voiceServer.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('TEXT:')) {
          const text = trimmed.replace('TEXT:', '');
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('voice-text', text);
          }
        } else if (trimmed.startsWith('STATUS:')) {
          const status = trimmed.replace('STATUS:', '');
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('voice-status', status);
          }
        }
      });
    });

    voiceServer.stderr.on('data', (data) => {
      console.log('Voice Server:', data.toString());
    });

    voiceServer.on('close', (code) => {
      console.log(`Voice Server exited with code ${code}`);
      voiceServer = null;
      // Restart after 5 seconds if it crashes (but not if app is quitting)
      if (code !== 0 && !appQuitting) {
        setTimeout(startVoiceServer, 5000);
      }
    });
  } catch (err) {
    console.error('Failed to spawn voice server process:', err.message);
  }
}

let piperProcess = null;

// Detect if text contains Urdu characters
function isUrdu(text) {
  return /[\u0600-\u06FF]/.test(text);
}

ipcMain.handle('speak-text', async (event, text) => {
  return new Promise((resolve, reject) => {
    if (piperProcess) {
      piperProcess.kill();
    }

    const piperPath = path.join(__dirname, '../piper_windows_amd64/piper/piper.exe');
    // Use appropriate model based on language
    const modelPath = isUrdu(text)
      ? path.join(__dirname, '../piper_windows_amd64/piper/ur_PK-fasih-medium.onnx')
      : path.join(__dirname, '../piper_windows_amd64/piper/en_US-hfc_male-medium.onnx');
    const tempWavPath = path.join(os.tmpdir(), `piper_tts_${Date.now()}.wav`);

    try {
      piperProcess = spawn(piperPath, ['--model', modelPath, '--output_file', tempWavPath]);

      piperProcess.on('error', (err) => {
        console.error('[Piper] Spawn error:', err.message);
        try { fs.unlinkSync(tempWavPath); } catch (e) { }
        piperProcess = null;
        resolve(null);
      });

      piperProcess.on('close', (code) => {
        piperProcess = null;
        if (code === 0) {
          try {
            const audioBuffer = fs.readFileSync(tempWavPath);
            resolve(audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength));
          } catch (e) {
            console.error('Error reading Piper WAV file:', e.message);
            resolve(null);
          } finally {
            try { fs.unlinkSync(tempWavPath); } catch (e) { }
          }
        } else {
          console.error('Piper exited with code:', code);
          try { fs.unlinkSync(tempWavPath); } catch (e) { }
          resolve(null);
        }
      });

      piperProcess.stdin.write(text);
      piperProcess.stdin.end();
    } catch (err) {
      console.error('Failed to spawn Piper process:', err.message);
      try { fs.unlinkSync(tempWavPath); } catch (e) { }
      resolve(null);
    }
  });
});

ipcMain.on('stop-speaking', () => {
  if (piperProcess) {
    piperProcess.kill();
    piperProcess = null;
  }
});

app.whenReady().then(() => {
  // Initialize memory system
  memory.initDatabase();
  memory.createSession();

  createWindow();
  startStatsWorker();
  startVoiceServer();
});

app.on('before-quit', () => {
  appQuitting = true;
  console.log('Cleaning up processes...');

  // Cleanup memory
  try { memory.closeDatabase(); } catch (e) {}

  // Terminate stats worker
  if (statsWorker) {
    try { statsWorker.terminate(); } catch (e) {}
    statsWorker = null;
  }

  // Kill voice server
  if (voiceServer) killProcessTree(voiceServer);
  voiceServer = null;

  // Kill piper if running
  if (piperProcess) killProcessTree(piperProcess);
  piperProcess = null;

  // Force kill any remaining python processes spawned by us
  try {
    execSync('taskkill /F /IM python.exe /T', { timeout: 3000, stdio: 'ignore' });
  } catch (e) {
    // ignore if no python processes
  }
});

app.on('will-quit', () => {
  // Fallback: make absolutely sure everything is dead
  if (statsWorker) {
    try { statsWorker.terminate(); } catch (e) {}
    statsWorker = null;
  }
  if (voiceServer) killProcessTree(voiceServer);
  if (piperProcess) killProcessTree(piperProcess);

  // Final force kill
  try {
    execSync('taskkill /F /IM python.exe /T', { timeout: 3000, stdio: 'ignore' });
  } catch (e) {}
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
