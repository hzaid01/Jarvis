import React from 'react';
import './ArcReactor.css';

const ArcReactor = React.memo(({ streaming = false }) => {
  return (
    <div className={`arc-reactor-container ${streaming ? 'streaming' : ''}`}>
      <div className="arc-ring arc-outer"></div>
      <div className="arc-ring arc-middle"></div>
      <div className="arc-ring arc-inner"></div>
      <div className="arc-core"></div>
    </div>
  );
});

export default ArcReactor;
