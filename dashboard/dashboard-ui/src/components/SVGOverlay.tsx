import React from 'react';
import { VB_X, VB_Y, VB_W, VB_H, ROOMS, ROOM_POLYGONS, HighlightCfg } from '../constants';
import { HAState, EntityConfig } from '../types';
import { BulbIcon } from './BulbIcon';
import { PresenceIndicator } from './PresenceIndicator';

interface Props {
    haStates: Record<string, HAState>;
    entityConfig: EntityConfig;
    humidityThreshold: number;
    litRooms: Set<string>;
}

// Maps ROOM_POLYGONS key → ROOMS key (for checking lit state)
const POLYGON_TO_ROOM: Record<string, string> = {
    wohnzimmer: 'wohnzimmer',
    kueche: 'kueche',      // no HA entity, always unlit
    buero: 'buero',
    hwr: 'hwr',
    flur: 'flur',
    schlafzimmer: 'schlafzimmer',
    toilette: 'toilette',
    badezimmer: 'badezimmer',
};

const HumidityHighlight: React.FC<{ cfg: NonNullable<HighlightCfg>; active: boolean }> = ({ cfg, active }) => {
    const style: React.CSSProperties = {
        fillOpacity: active ? undefined : 0,
        animation: active ? 'hum-blink 2.5s ease-in-out infinite' : undefined,
        pointerEvents: 'none',
    };
    if (cfg.shape === 'rect')
        return <rect x={cfg.x} y={cfg.y} width={cfg.w} height={cfg.h} fill="#ff2222" style={style} />;
    return <polygon points={cfg.pts} fill="#ff2222" style={style} />;
};

export const SVGOverlay: React.FC<Props> = ({
    haStates, entityConfig, humidityThreshold, litRooms,
}) => (
    <svg
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
        <defs>
            <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* ── Room walls (drawn once per room, zero doubles) ──────────────── */}
        {Object.entries(ROOM_POLYGONS).map(([key, pts]) => {
            const room = POLYGON_TO_ROOM[key] ?? key;
            const lit = litRooms.has(room);
            return (
                <polygon
                    key={key}
                    points={pts}
                    fill="none"
                    stroke={lit ? '#c8c8c8' : '#686868'}
                    strokeWidth={0.5}
                    strokeLinejoin="miter"
                />
            );
        })}

        {/* ── Humidity highlights, bulbs, presence ───────────────────────── */}
        {Object.entries(ROOMS).map(([room, cfg]) => {
            const ents = entityConfig[room] ?? {};
            const humState = ents.humidity ? haStates[ents.humidity] : undefined;
            const humVal = humState ? parseFloat(humState.state) : NaN;
            const humAlert = !isNaN(humVal) && humVal > humidityThreshold;
            const lightState = ents.light ? haStates[ents.light] : undefined;
            const presenceState = ents.presence ? haStates[ents.presence] : undefined;

            return (
                <g key={room}>
                    {cfg.highlight && <HumidityHighlight cfg={cfg.highlight} active={humAlert} />}
                    {cfg.bulb && <BulbIcon cfg={cfg.bulb} state={lightState} />}
                    {cfg.presence && <PresenceIndicator cfg={cfg.presence} state={presenceState} />}
                </g>
            );
        })}
    </svg>
);
