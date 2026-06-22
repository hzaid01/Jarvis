import React, { useState, useEffect, useCallback } from 'react';

const TABS = ['Profile', 'Memories', 'Sessions'];

export default function MemoryPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const [profile, setProfile] = useState({});
  const [observations, setObservations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Load data on mount & tab change ──────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, obs, sess] = await Promise.all([
        window.electronAPI.memoryGetProfile(),
        window.electronAPI.memoryGetAll(),
        window.electronAPI.memoryGetSessions(),
      ]);
      setProfile(prof || {});
      setObservations(obs || []);
      setSessions(sess || []);
    } catch (err) {
      console.error('Failed to load memory data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Search ───────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await window.electronAPI.memorySearch(searchQuery);
      setSearchResults(results || []);
    } catch (err) {
      console.error('Memory search failed:', err);
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) handleSearch();
      else setSearchResults(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // ── Delete observation ───────────────────────────────────────
  const handleDeleteObs = async (id) => {
    try {
      await window.electronAPI.memoryDelete(id);
      setObservations(prev => prev.filter(o => o.id !== id));
      if (searchResults) {
        setSearchResults(prev => prev.filter(o => o.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete observation:', err);
    }
  };

  // ── Close on Escape ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Type badge color ─────────────────────────────────────────
  const getTypeBadgeClass = (type) => {
    const map = {
      user_info: 'badge-info',
      topic: 'badge-topic',
      task: 'badge-task',
      emotion: 'badge-emotion',
      preference: 'badge-pref',
      decision: 'badge-decision',
    };
    return map[type] || 'badge-topic';
  };

  // ── Render Profile Tab ───────────────────────────────────────
  const renderProfile = () => {
    const entries = Object.entries(profile);
    if (entries.length === 0) {
      return (
        <div className="memory-empty">
          <span className="memory-empty-icon">👤</span>
          <p>No profile data yet.</p>
          <p className="memory-empty-hint">Tell Jarvis your name, age, or preferences and they'll appear here.</p>
        </div>
      );
    }
    return (
      <div className="memory-list">
        {entries.map(([key, value]) => (
          <div key={key} className="memory-card profile-card">
            <div className="memory-card-header">
              <span className="memory-card-key">{key.replace(/_/g, ' ')}</span>
            </div>
            <div className="memory-card-value">{value}</div>
          </div>
        ))}
      </div>
    );
  };

  // ── Render Memories Tab ──────────────────────────────────────
  const renderMemories = () => {
    const items = searchResults !== null ? searchResults : observations;
    if (items.length === 0) {
      return (
        <div className="memory-empty">
          <span className="memory-empty-icon">🧠</span>
          <p>{searchResults !== null ? 'No matching memories found.' : 'No memories recorded yet.'}</p>
          <p className="memory-empty-hint">Start chatting and Jarvis will remember important details.</p>
        </div>
      );
    }
    return (
      <div className="memory-list">
        {items.map((obs) => (
          <div key={obs.id} className="memory-card">
            <div className="memory-card-header">
              <span className={`memory-type-badge ${getTypeBadgeClass(obs.type)}`}>
                {obs.type.replace(/_/g, ' ')}
              </span>
              <span className="memory-card-date">{obs.date} {obs.time}</span>
              <button
                className="memory-delete-btn"
                onClick={() => handleDeleteObs(obs.id)}
                title="Delete memory"
              >
                ✕
              </button>
            </div>
            <div className="memory-card-content">{obs.content}</div>
            {obs.keywords && (
              <div className="memory-card-keywords">
                {obs.keywords.split(',').filter(Boolean).map((kw, i) => (
                  <span key={i} className="memory-keyword">{kw}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ── Render Sessions Tab ──────────────────────────────────────
  const renderSessions = () => {
    if (sessions.length === 0) {
      return (
        <div className="memory-empty">
          <span className="memory-empty-icon">📋</span>
          <p>No sessions recorded yet.</p>
          <p className="memory-empty-hint">Sessions are summarized automatically after conversations.</p>
        </div>
      );
    }
    return (
      <div className="memory-list">
        {sessions.map((sess) => (
          <div key={sess.id} className="memory-card session-card">
            <div className="memory-card-header">
              <span className="memory-session-day">{sess.day_of_week}</span>
              <span className="memory-card-date">{sess.date} {sess.time}</span>
              {sess.message_count > 0 && (
                <span className="memory-msg-count">{sess.message_count} msgs</span>
              )}
            </div>
            {sess.summary ? (
              <div className="memory-card-content">{sess.summary}</div>
            ) : (
              <div className="memory-card-content dim">Session in progress...</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="memory-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="memory-panel">
        <button className="settings-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div className="memory-header">
          <div className="memory-title">
            <span className="memory-icon">🧠</span>
            MEMORY CORE
          </div>
          {!loading && (
            <div className="memory-stats-bar">
              <span>{Object.keys(profile).length} profile</span>
              <span className="memory-stats-sep">|</span>
              <span>{observations.length} memories</span>
              <span className="memory-stats-sep">|</span>
              <span>{sessions.length} sessions</span>
            </div>
          )}
        </div>

        {/* Search bar (shown on Memories tab) */}
        {activeTab === 1 && (
          <div className="memory-search-wrap">
            <input
              type="text"
              className="memory-search-input"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="memory-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="memory-tabs">
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              className={`memory-tab ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setActiveTab(idx)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="memory-content">
          {loading ? (
            <div className="memory-empty">
              <span className="memory-empty-icon">⏳</span>
              <p>Loading memory data...</p>
            </div>
          ) : (
            <>
              {activeTab === 0 && renderProfile()}
              {activeTab === 1 && renderMemories()}
              {activeTab === 2 && renderSessions()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
