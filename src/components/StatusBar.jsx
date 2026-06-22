import React, { useState, useEffect } from 'react';

const StatusBar = React.memo(({ logs }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="status-bar">
      <span className="label">ACTIVITY LOG</span>
      <div className="log-entries">
        {logs.map((log, i) => {
          const isNewest = i === logs.length - 1;
          return (
            <span key={i} className={`log-entry ${isNewest ? 'newest' : ''}`}>
              {isNewest && <span className="blinking-dot" />}
              <span className="type">{log.type}</span>
              <span className="separator">::</span>
              <span>{log.message}</span>
              <span className="separator"> | </span>
            </span>
          );
        })}
      </div>
      <span className="timestamp">
        {formatDate(time)} {formatTime(time)}
      </span>
    </div>
  );
});

export default StatusBar;
