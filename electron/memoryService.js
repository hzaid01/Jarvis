// ============================================================
// Memory Service — SQLite-based persistent memory for JARVIS
// Uses better-sqlite3 (synchronous) in Electron main process
// DB stored at: %APPDATA%/jarvis/memory.db
// ============================================================

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let currentSessionId = null;

// ── Date/Time helpers (DD/MM/YYYY, HH:MM:SS) ──────────────────
function getDateStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function getTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getDayOfWeek() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getFullTimestamp() {
  return `${getDateStr()} ${getTimeStr()}`;
}

// ── Database Initialization ────────────────────────────────────
function initDatabase() {
  try {
    const Database = require('better-sqlite3');
    const dbDir = path.join(app.getPath('userData'), 'jarvis');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'memory.db');
    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        summary TEXT DEFAULT '',
        message_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT DEFAULT '',
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_obs_keywords ON observations(keywords);
      CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(session_id);
    `);

    console.log('Memory database initialized:', dbPath);
    return true;
  } catch (err) {
    console.error('Failed to initialize memory database:', err.message);
    return false;
  }
}

// ── Session Management ─────────────────────────────────────────
function createSession() {
  if (!db) return null;
  try {
    const stmt = db.prepare(
      'INSERT INTO sessions (date, time, day_of_week, created_at) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(getDateStr(), getTimeStr(), getDayOfWeek(), getFullTimestamp());
    currentSessionId = result.lastInsertRowid;
    console.log('New memory session:', currentSessionId);
    return currentSessionId;
  } catch (err) {
    console.error('Failed to create session:', err.message);
    return null;
  }
}

function getCurrentSessionId() {
  return currentSessionId;
}

function updateSessionSummary(sessionId, summary, messageCount) {
  if (!db) return;
  try {
    db.prepare(
      'UPDATE sessions SET summary = ?, message_count = ? WHERE id = ?'
    ).run(summary, messageCount, sessionId);
  } catch (err) {
    console.error('Failed to update session summary:', err.message);
  }
}

function getRecentSessions(limit = 5) {
  if (!db) return [];
  try {
    return db.prepare(
      'SELECT * FROM sessions ORDER BY id DESC LIMIT ?'
    ).all(limit);
  } catch (err) {
    console.error('Failed to get recent sessions:', err.message);
    return [];
  }
}

// ── User Profile ───────────────────────────────────────────────
function saveUserProfile(key, value) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO user_profile (key, value, updated_at) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, getFullTimestamp());
  } catch (err) {
    console.error('Failed to save user profile:', err.message);
  }
}

function getUserProfile() {
  if (!db) return {};
  try {
    const rows = db.prepare('SELECT key, value, updated_at FROM user_profile ORDER BY key').all();
    const profile = {};
    for (const row of rows) {
      profile[row.key] = row.value;
    }
    return profile;
  } catch (err) {
    console.error('Failed to get user profile:', err.message);
    return {};
  }
}

function deleteProfile(key) {
  if (!db) return;
  try {
    db.prepare('DELETE FROM user_profile WHERE key = ?').run(key);
  } catch (err) {
    console.error('Failed to delete profile key:', err.message);
  }
}

// ── Observations ───────────────────────────────────────────────
function saveObservation(sessionId, type, content, keywords) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO observations (session_id, timestamp, date, time, day_of_week, type, content, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId || currentSessionId,
      getFullTimestamp(),
      getDateStr(),
      getTimeStr(),
      getDayOfWeek(),
      type,
      content,
      keywords
    );
  } catch (err) {
    console.error('Failed to save observation:', err.message);
  }
}

function getAllObservations(limit = 100) {
  if (!db) return [];
  try {
    return db.prepare(
      'SELECT * FROM observations ORDER BY id DESC LIMIT ?'
    ).all(limit);
  } catch (err) {
    console.error('Failed to get observations:', err.message);
    return [];
  }
}

function deleteObservation(id) {
  if (!db) return;
  try {
    db.prepare('DELETE FROM observations WHERE id = ?').run(id);
  } catch (err) {
    console.error('Failed to delete observation:', err.message);
  }
}

function searchObservations(query) {
  if (!db || !query) return [];
  try {
    const { extractKeywords, rankObservations } = require('./memorySearch');
    const keywords = extractKeywords(query);
    if (keywords.length === 0) return [];

    // Build a LIKE query for each keyword
    const conditions = keywords.map(() => 'keywords LIKE ?').join(' OR ');
    const params = keywords.map(k => `%${k}%`);

    const rows = db.prepare(
      `SELECT * FROM observations WHERE ${conditions} ORDER BY id DESC LIMIT 50`
    ).all(...params);

    return rankObservations(rows, keywords, 5);
  } catch (err) {
    console.error('Failed to search observations:', err.message);
    return [];
  }
}

// ── Auto-Extraction ────────────────────────────────────────────
// Extracts user info, topics, tasks, emotions from each message turn
function autoExtractAndSave(sessionId, userMessage, aiResponse) {
  if (!db || !userMessage) return;

  const sid = sessionId || currentSessionId;
  const msgLower = userMessage.toLowerCase();

  // ── Extract user name ──
  const namePatterns = [
    /my name is (\w+)/i,
    /i(?:'m| am) (\w+)/i,
    /call me (\w+)/i,
    /i go by (\w+)/i,
    /this is (\w+)/i,
  ];
  for (const pat of namePatterns) {
    const match = userMessage.match(pat);
    if (match && match[1]) {
      const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      // Skip common words that aren't names
      const skipWords = ['a', 'the', 'your', 'here', 'there', 'fine', 'good', 'great', 'okay', 'sure', 'not', 'just', 'doing', 'feeling', 'looking', 'interested', 'curious'];
      if (!skipWords.includes(name.toLowerCase())) {
        saveUserProfile('name', name);
        saveObservation(sid, 'user_info', `User's name is ${name}`, `name,${name.toLowerCase()}`);
      }
      break;
    }
  }

  // ── Extract age ──
  const ageMatch = userMessage.match(/i(?:'m| am) (\d{1,3})(?: years? old)?/i) ||
                   userMessage.match(/my age is (\d{1,3})/i);
  if (ageMatch && ageMatch[1]) {
    const age = parseInt(ageMatch[1]);
    if (age > 0 && age < 150) {
      saveUserProfile('age', String(age));
      saveObservation(sid, 'user_info', `User is ${age} years old`, `age,${age},years`);
    }
  }

  // ── Extract birthday ──
  const bdayMatch = userMessage.match(/my birthday is (.+?)(?:\.|,|$)/i) ||
                    userMessage.match(/born on (.+?)(?:\.|,|$)/i);
  if (bdayMatch && bdayMatch[1]) {
    saveUserProfile('birthday', bdayMatch[1].trim());
    saveObservation(sid, 'user_info', `User's birthday is ${bdayMatch[1].trim()}`, `birthday,born`);
  }

  // ── Extract location ──
  const locMatch = userMessage.match(/i(?:'m| am) (?:from|in|at|based in) (.+?)(?:\.|,|$)/i) ||
                   userMessage.match(/i live in (.+?)(?:\.|,|$)/i);
  if (locMatch && locMatch[1]) {
    const location = locMatch[1].trim();
    if (location.length > 1 && location.length < 50) {
      saveUserProfile('location', location);
      saveObservation(sid, 'user_info', `User is from/in ${location}`, `location,${location.toLowerCase()}`);
    }
  }

  // ── Detect emotion ──
  const emotions = {
    frustrated: ['frustrated', 'annoyed', 'angry', 'mad', 'irritated', 'pissed', 'hate'],
    happy: ['happy', 'excited', 'great', 'awesome', 'love', 'wonderful', 'amazing', 'fantastic'],
    sad: ['sad', 'depressed', 'down', 'unhappy', 'terrible', 'miserable'],
    stressed: ['stressed', 'overwhelmed', 'anxious', 'worried', 'nervous'],
    tired: ['tired', 'exhausted', 'sleepy', 'drained', 'burnt out'],
  };

  for (const [emotion, triggers] of Object.entries(emotions)) {
    if (triggers.some(t => msgLower.includes(t))) {
      saveObservation(sid, 'emotion', `User seems ${emotion}: "${userMessage.substring(0, 80)}"`, `emotion,${emotion}`);
      break;
    }
  }

  // ── Detect tasks / preferences ──
  if (msgLower.match(/i (?:need to|have to|must|should|want to|gonna|going to) /)) {
    saveObservation(sid, 'task', userMessage.substring(0, 200), buildKeywordString(userMessage));
  }

  if (msgLower.match(/i (?:like|prefer|love|enjoy|hate|dislike|don't like) /)) {
    saveObservation(sid, 'preference', userMessage.substring(0, 200), buildKeywordString(userMessage));
  }

  // ── Save general topic ──
  saveObservation(sid, 'topic', userMessage.substring(0, 200), buildKeywordString(userMessage));
}

function buildKeywordString(text) {
  const { extractKeywords } = require('./memorySearch');
  return extractKeywords(text).slice(0, 10).join(',');
}

// ── Dynamic System Prompt Builder ──────────────────────────────
function buildSystemPrompt(currentMessage, location) {
  const date = getDateStr();
  const time = getTimeStr();
  const day = getDayOfWeek();

  let prompt = `You are JARVIS — Just A Rather Very Intelligent System.
You are the personal AI of your user running locally on their machine.
Be concise — max 3 sentences unless asked for detail.
Address user as "Sir" occasionally.\n`;

  // ── Current context ──
  prompt += `\nCURRENT CONTEXT:\n`;
  prompt += `- Date/Time: ${day}, ${date} at ${time}\n`;
  if (location && location.city !== 'Unknown') {
    prompt += `- Location: ${location.city}, ${location.country}\n`;
    prompt += `- Weather context: use location for weather queries\n`;
  }
  prompt += `- PC Control: Active (you can open apps, control system)\n`;
  prompt += `- Web Search: Active via Tavily API\n`;

  // ── Inject user profile ──
  const profile = getUserProfile();
  if (Object.keys(profile).length > 0) {
    const profileEntries = Object.entries(profile)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (profile.name) {
      prompt += `\nYou are speaking with ${profile.name}.\n`;
    }
    prompt += `User Profile: ${profileEntries}\n`;
  }

  // ── Inject recent sessions ──
  const sessions = getRecentSessions(5);
  if (sessions.length > 0) {
    prompt += `\nRecent Sessions:\n`;
    for (const s of sessions) {
      if (s.summary) {
        prompt += `- ${s.day_of_week} ${s.date} ${s.time}: ${s.summary.substring(0, 100)}\n`;
      }
    }
  }

  // ── Inject relevant past context ──
  if (currentMessage) {
    const relevant = searchObservations(currentMessage);
    if (relevant.length > 0) {
      prompt += `\nRelevant Past Context:\n`;
      for (const obs of relevant) {
        prompt += `- [${obs.date}] ${obs.content.substring(0, 80)}\n`;
      }
    }
  }

  prompt += `\nCAPABILITIES:\n`;
  prompt += `- Open any app via voice or text\n`;
  prompt += `- Search the web for current info\n`;
  prompt += `- Control system (volume, screenshot, shutdown)\n`;
  prompt += `- Remember user preferences across sessions\n`;

  prompt += `\nLANGUAGE RULES:\n`;
  prompt += `- If user speaks in Urdu or Roman Urdu, respond in natural conversational Urdu\n`;
  prompt += `- Use natural human Urdu — not formal/robotic\n`;
  prompt += `- Mix English technical terms naturally like Pakistanis do\n`;
  prompt += `- Example: "Sir, abhi CPU 34% par hai aur sab kuch theek chal raha hai"\n`;
  prompt += `- Never use stiff/formal Urdu — keep it natural and conversational\n`;
  prompt += `- If user speaks English, respond in English\n`;
  prompt += `- Match user's language automatically\n`;

  prompt += `\nWhen executing commands, confirm destructive actions.\nKeep responses sharp and intelligent.\nAlways remember and reference past conversations naturally.`;

  // Cap at roughly 500 tokens (~2000 chars)
  if (prompt.length > 2000) {
    prompt = prompt.substring(0, 1950) + '\n[memory truncated for speed]';
  }

  return prompt;
}

// ── Session Summarization ──────────────────────────────────────
async function summarizeSession(sessionId, conversation) {
  if (!db || !conversation || conversation.length === 0) return;

  try {
    // Build conversation text for summarization
    const text = conversation
      .slice(-20) // Last 20 messages max
      .map(m => `${m.role}: ${m.content.substring(0, 150)}`)
      .join('\n');

    // Ask Ollama to summarize
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.5:4b',
        messages: [
          {
            role: 'system',
            content: 'Summarize this conversation in 1-2 sentences. Focus on key topics, decisions, and user requests. Be concise.'
          },
          { role: 'user', content: text }
        ],
        stream: false,
        think: false,
        options: { num_predict: 100 },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const summary = data.message?.content || '';
      updateSessionSummary(sessionId, summary, conversation.length);
    }
  } catch (err) {
    // Summarization is best-effort, don't crash
    console.error('Session summarization failed:', err.message);
  }

  // Rotate old sessions — keep last 50
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM sessions').get();
    if (count.c > 50) {
      db.prepare(`
        DELETE FROM observations WHERE session_id IN (
          SELECT id FROM sessions ORDER BY id ASC LIMIT ?
        )
      `).run(count.c - 50);
      db.prepare(
        'DELETE FROM sessions WHERE id NOT IN (SELECT id FROM sessions ORDER BY id DESC LIMIT 50)'
      ).run();
    }
  } catch (err) {
    console.error('Session rotation failed:', err.message);
  }
}

// ── Stats ──────────────────────────────────────────────────────
function getStats() {
  if (!db) return { observations: 0, sessions: 0, profileKeys: 0 };
  try {
    const obs = db.prepare('SELECT COUNT(*) as c FROM observations').get();
    const sess = db.prepare('SELECT COUNT(*) as c FROM sessions').get();
    const prof = db.prepare('SELECT COUNT(*) as c FROM user_profile').get();
    return {
      observations: obs.c,
      sessions: sess.c,
      profileKeys: prof.c,
    };
  } catch (err) {
    return { observations: 0, sessions: 0, profileKeys: 0 };
  }
}

// ── Cleanup ────────────────────────────────────────────────────
function closeDatabase() {
  if (db) {
    try { db.close(); } catch (e) {}
    db = null;
  }
}

module.exports = {
  initDatabase,
  createSession,
  getCurrentSessionId,
  updateSessionSummary,
  getRecentSessions,
  saveUserProfile,
  getUserProfile,
  deleteProfile,
  saveObservation,
  getAllObservations,
  deleteObservation,
  searchObservations,
  autoExtractAndSave,
  buildSystemPrompt,
  summarizeSession,
  getStats,
  closeDatabase,
};
