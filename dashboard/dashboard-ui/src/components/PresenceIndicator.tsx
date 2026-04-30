import React from 'react';
import { PresenceCfg } from '../constants';
import { HAState } from '../types';

export const PresenceIndicator: React.FC<{ cfg: PresenceCfg; state: HAState | undefined }> = ({ cfg, state }) => {
  const active = state?.state === 'on';

  if (cfg.type === 'dot') {
    return (
      <circle
        cx={cfg.cx} cy={cfg.cy} r={2.2}
        fill={active ? '#22dd22' : 'transparent'}
        filter={active ? 'url(#glow)' : undefined}
      />
    );
  }

  return (
    <text
      x={cfg.cx} y={cfg.cy}
      textAnchor="middle"
      fontSize={2.4}
      fontFamily="DejaVu Sans, sans-serif"
      fontWeight="bold"
      fill={active ? '#ff6666' : '#22cc22'}
    >
      {active ? 'Occupied' : 'Free'}
    </text>
  );
};
