import React from 'react';
import { BulbCfg } from '../constants';
import { HAState } from '../types';

function resolveColor(state: HAState | undefined): { fill: string; glow: boolean } {
  if (!state || state.state === 'unavailable') return { fill: '#2a2a2a', glow: false };
  if (state.state !== 'on')                   return { fill: '#484848', glow: false };

  const brightness = (state.attributes.brightness ?? 255) / 255;
  const rgb = state.attributes.rgb_color;
  let fill: string;
  if (rgb) {
    fill = `rgb(${Math.round(rgb[0] * brightness)},${Math.round(rgb[1] * brightness)},${Math.round(rgb[2] * brightness)})`;
  } else {
    const v = Math.round(120 + brightness * 130);
    fill = `rgb(${v},${Math.round(v * 0.88)},${Math.round(v * 0.46)})`;
  }
  return { fill, glow: true };
}

export const BulbIcon: React.FC<{ cfg: BulbCfg; state: HAState | undefined }> = ({ cfg, state }) => {
  const { fill, glow } = resolveColor(state);
  return (
    <g transform={`translate(${cfg.cx},${cfg.cy})`}>
      <circle cx={0} cy={-2} r={2.8} fill={fill} filter={glow ? 'url(#glow)' : undefined} />
      <rect x={-1.5} y={0.8} width={3}   height={1.2} rx={0.3} fill="#666" />
      <rect x={-1.1} y={2.1} width={2.2} height={0.9} rx={0.3} fill="#666" />
    </g>
  );
};
