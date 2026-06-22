const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // System stats
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),

  // Voice capabilities
  onVoiceText: (callback) => {
    const handler = (_event, text) => callback(text);
    ipcRenderer.on('voice-text', handler);
    return () => ipcRenderer.removeListener('voice-text', handler);
  },
  onVoiceStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('voice-status', handler);
    return () => ipcRenderer.removeListener('voice-status', handler);
  },
  speakText: (text) => ipcRenderer.invoke('speak-text', text),
  stopSpeaking: () => ipcRenderer.send('stop-speaking'),

  // Memory system
  memoryBuildPrompt: (message) => ipcRenderer.invoke('memory-build-prompt', message),
  memorySaveTurn: (userMsg, aiResponse) => ipcRenderer.invoke('memory-save-turn', userMsg, aiResponse),
  memoryGetAll: () => ipcRenderer.invoke('memory-get-all'),
  memoryGetProfile: () => ipcRenderer.invoke('memory-get-profile'),
  memoryGetSessions: () => ipcRenderer.invoke('memory-get-sessions'),
  memoryDelete: (id) => ipcRenderer.invoke('memory-delete', id),
  memorySearch: (query) => ipcRenderer.invoke('memory-search', query),

  // System context
  getSystemTime: () => ipcRenderer.invoke('get-system-time'),
  getLocation: () => ipcRenderer.invoke('get-location'),

  // Chat log persistence
  saveChatLog: (messages) => ipcRenderer.invoke('save-chat-log', messages),
  loadChatLog: () => ipcRenderer.invoke('load-chat-log'),
  clearChatLog: () => ipcRenderer.invoke('clear-chat-log'),
  getChatLogSize: () => ipcRenderer.invoke('get-chat-log-size'),

  // Volume control (nircmd)
  volumeUp: () => ipcRenderer.invoke('volume-up'),
  volumeDown: () => ipcRenderer.invoke('volume-down'),
  volumeMute: () => ipcRenderer.invoke('volume-mute'),
  setVolume: (level) => ipcRenderer.invoke('set-volume', level),

  // PC Control — Tool Execution
  executeTool: (toolName, params) => ipcRenderer.invoke('execute-tool', toolName, params),

  // Blocker signals
  aiStarted: () => ipcRenderer.send('ai-started'),
  aiStopped: () => ipcRenderer.send('ai-stopped'),
});
