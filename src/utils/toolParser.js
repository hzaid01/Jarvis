/**
 * toolParser.js — Parse AI responses for tool calls
 * 
 * AI outputs structured tool calls in this format:
 *   <<<TOOL:tool_name|param1=value1|param2=value2>>>
 * 
 * This parser extracts them and returns clean display text + tool array.
 */

const TOOL_REGEX = /<<<TOOL:(\w+)\|?([^>]*)>>>/g;

/**
 * Parse an AI response string for embedded tool calls.
 * @param {string} response - Raw AI response text
 * @returns {{ displayText: string, tools: Array<{ name: string, params: object }> }}
 */
export function parseToolCalls(response) {
  if (!response) return { displayText: '', tools: [] };

  const tools = [];
  let match;

  // Reset regex state
  TOOL_REGEX.lastIndex = 0;

  while ((match = TOOL_REGEX.exec(response)) !== null) {
    const name = match[1];
    const paramStr = match[2] || '';
    const params = {};

    if (paramStr.trim()) {
      paramStr.split('|').forEach(pair => {
        const eqIndex = pair.indexOf('=');
        if (eqIndex > 0) {
          const key = pair.substring(0, eqIndex).trim();
          const value = pair.substring(eqIndex + 1).trim();
          params[key] = value;
        }
      });
    }

    tools.push({ name, params });
  }

  // Remove tool tokens from display text
  const displayText = response.replace(TOOL_REGEX, '').trim();

  return { displayText, tools };
}

/**
 * Check if a response contains any tool calls
 */
export function hasToolCalls(response) {
  if (!response) return false;
  TOOL_REGEX.lastIndex = 0;
  return TOOL_REGEX.test(response);
}

/**
 * Build the tool schema section for the AI system prompt.
 * This tells the AI what tools are available and how to call them.
 */
export function getToolSystemPrompt() {
  return `
You have full PC control through tools. When the user asks you to do something on their computer, respond naturally AND include a tool call using this format:

<<<TOOL:tool_name|param1=value1|param2=value2>>>

AVAILABLE TOOLS:
- open_app: Open any application. Params: app_name (e.g. Chrome, Notepad, Discord, Spotify)
- open_url: Open a URL in the default browser. Params: url
- web_search: Search the internet for information. Params: query
- take_screenshot: Capture the screen and save to Desktop. No params needed.
- volume_control: Adjust system volume. Params: action (up/down/mute/unmute/set), value (0-100 for set)
- brightness_control: Adjust screen brightness. Params: action (up/down/set), value (0-100 for set)
- file_control: Manage files/folders. Params: action (list/read/write/delete/move/copy/create_folder/find), path, content (for write), destination (for move/copy), name (for find)
- run_powershell: Execute any PowerShell command. Params: command
- get_system_info: Get system information. Params: type (processes/cpu/memory/disk/network/battery/uptime)
- close_app: Close a running application. Params: name
- system_power: System power management. Params: action (shutdown/restart/sleep/lock)
- open_folder: Open File Explorer at a path. Params: path (default: Desktop)
- search_files: Search for files by name. Params: query, path (default: C:\\Users), extension (optional, e.g. .pdf)

IMPORTANT RULES:
1. Always respond with natural language FIRST, then add the tool call at the end.
2. You can chain multiple tools in one response.
3. For destructive actions (delete files, kill processes, shutdown), warn the user and still include the tool call — the system will ask for confirmation.
4. When tool results are returned to you, use them to give a helpful summary to the user.
5. If the user asks something that needs current/live information (weather, news, prices, latest anything), use web_search.

EXAMPLES:
User: "Open Chrome"
Response: Opening Chrome for you, Sir. <<<TOOL:open_app|app_name=Chrome>>>

User: "What's the weather in New York?"
Response: Let me search that for you, Sir. <<<TOOL:web_search|query=weather in New York today>>>

User: "Set volume to 50%"
Response: Setting volume to 50%, Sir. <<<TOOL:volume_control|action=set|value=50>>>

User: "What apps are running?"
Response: Let me check the running processes, Sir. <<<TOOL:get_system_info|type=processes>>>

User: "Delete the temp folder on Desktop"
Response: I'll delete the temp folder on your Desktop, Sir. Please confirm when prompted. <<<TOOL:file_control|action=delete|path=C:\\Users\\$USER\\Desktop\\temp>>>

User: "Run ipconfig"
Response: Running ipconfig, Sir. <<<TOOL:run_powershell|command=ipconfig>>>

User: "Take a screenshot"
Response: Capturing your screen now, Sir. <<<TOOL:take_screenshot>>>

User: "Search for PDF files in Downloads"
Response: Searching for PDF files in your Downloads folder, Sir. <<<TOOL:search_files|query=*|path=C:\\Users\\$USER\\Downloads|extension=.pdf>>>
`.trim();
}
