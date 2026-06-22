import React, { useEffect, useState, useRef } from 'react';

// Custom hook for count-up animation
function useCountUp(targetValue, duration = 1500) {
  const [value, setValue] = useState(targetValue || 0);
  const prevTargetRef = useRef(targetValue || 0);
  const currentValueRef = useRef(targetValue || 0);

  useEffect(() => {
    // If target hasn't changed, don't run
    if (targetValue === prevTargetRef.current) return;
    
    let startTime = null;
    let animationFrame;
    const startValue = currentValueRef.current;
    
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function: easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const newValue = startValue + (targetValue - startValue) * easeProgress;
      
      currentValueRef.current = newValue;
      setValue(newValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    prevTargetRef.current = targetValue;

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [targetValue, duration]);

  return value;
}

const CircularGauge = React.memo(({ 
  value = 0, 
  max = 100, 
  size = 120, 
  strokeWidth = 8, 
  label = '', 
  subLabel = '', 
  color = 'var(--hud-cyan)' 
}) => {
  const animatedValue = useCountUp(value);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Arc angle (e.g., 270 degrees out of 360)
  const arcOffset = circumference * 0.25; // 25% gap at bottom
  const dashArray = `${circumference - arcOffset} ${arcOffset}`;
  
  const percentage = Math.min(Math.max(animatedValue / max, 0), 1);
  const strokeDashoffset = (circumference - arcOffset) * (1 - percentage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`} 
          style={{ transform: 'rotate(135deg)' }}
        >
          {/* Drop shadow filter */}
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(0, 229, 255, 0.05)"
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
          
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>

        {/* Center Text */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Orbitron, sans-serif',
        }}>
          <span style={{ 
            fontSize: `${size * 0.2}px`, 
            fontWeight: 'bold', 
            color: color,
            textShadow: `0 0 8px ${color}`,
          }}>
            {Math.round(animatedValue)}%
          </span>
          {label && (
            <span style={{ 
              fontSize: `${size * 0.08}px`, 
              color: 'var(--hud-text-dim)',
              letterSpacing: '0.1em'
            }}>
              {label}
            </span>
          )}
        </div>
      </div>
      
      {/* Sub Label */}
      {subLabel && (
        <div style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '11px',
          color: 'var(--hud-text-dim)',
          textShadow: '0 0 5px rgba(255,255,255,0.2)',
          marginTop: '4px'
        }}>
          {subLabel}
        </div>
      )}
    </div>
  );
});

export default CircularGauge;
