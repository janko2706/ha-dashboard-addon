// SVG viewBox and screen dimensions — must stay in sync with vite.config publicDir.
export const VB_X = 158;
export const VB_Y = 83;
export const VB_W = 214;
export const VB_H = 114;
export const FP_W = 1320;
export const FP_H = 703;

export function svgToScreen(svgX: number, svgY: number): { x: number; y: number } {
    return {
        x: ((svgX - VB_X) / VB_W) * FP_W,
        y: ((svgY - VB_Y) / VB_H) * FP_H,
    };
}

// ── Room layout types ──────────────────────────────────────────────────────

export interface DialCfg { svgCx: number; svgCy: number; }
export interface ClimateCfg { temp: DialCfg; hum: DialCfg; }
export interface BulbCfg { cx: number; cy: number; scale?: number; }
export interface PresenceCfg { type: 'dot' | 'text'; cx: number; cy: number; }

export type HighlightCfg =
    | { shape: 'rect'; x: number; y: number; w: number; h: number }
    | { shape: 'polygon'; pts: string }
    | null;

export interface RoomCfg {
    highlight: HighlightCfg;
    bulb: BulbCfg | null;
    bulb2?: BulbCfg;
    presence?: PresenceCfg;
    climate?: ClimateCfg;
    wallGroupId: string;
}

// ── Room definitions ───────────────────────────────────────────────────────
// svgCx/svgCy for climate dials are the arc-centre positions in SVG source coords.

// ── Room wall polygons ─────────────────────────────────────────────────────
// Every room listed here gets a <polygon> border drawn by SVGOverlay.
// Coordinates are in SVG source space (viewBox 0 0 562 364).
// Edit these to move/resize walls — they're drawn exactly once per edge,
// so there are zero double-walls.
//
// Rooms without HA entities (Küche, Büro, HWR) are still drawn for context.

export const ROOM_POLYGONS: Record<string, string> = {
    wohnzimmer: '190,87  249,87  249,131 190,131',
    kueche: '190,131 249,131 249,161 190,161',
    buero: '190,161 249,161 249,191 190,191',
    hwr: '249,87  281,87  281,116 249,116',
    // L-shaped: main Flur + corridor extension toward Toilette
    flur: '249,116 294.697,116 294.697,140 280.113,140 280.113,191 249,191',
    // L-shaped: main room + lower extension above Badezimmer
    schlafzimmer: '281,87 335.152,87 335.152,129 294.767,129 294.767,116 281,116',
    toilette: '280,140 294.755,140 294.755,166 280,166',
    badezimmer: '294.823,128.977 335.233,128.977 335.233,165.949 294.823,165.949',
};

export const ROOMS: Record<string, RoomCfg> = {
    wohnzimmer: {
        highlight: { shape: 'rect', x: 190, y: 87, w: 58, h: 43 },
        bulb: { cx: 219, cy: 109 },
        bulb2: { cx: 234, cy: 93, scale: 0.65 },
        climate: { temp: { svgCx: 204, svgCy: 127 }, hum: { svgCx: 234, svgCy: 127 } },
        wallGroupId: 'Wohnzimmer',
    },
    schlafzimmer: {
        highlight: { shape: 'polygon', pts: '281,87 335.152,87 335.152,129 294.767,129 294.767,116 281,116' },
        bulb: { cx: 310, cy: 105 },
        climate: { temp: { svgCx: 305, svgCy: 125 }, hum: { svgCx: 328, svgCy: 125 } },
        wallGroupId: 'Schlafzimmer',
    },
    flur: {
        highlight: { shape: 'polygon', pts: '249,116 294.697,116 294.697,140 280.113,140 280.113,191 249,191' },
        bulb: { cx: 263, cy: 135 },
        presence: { type: 'dot', cx: 264, cy: 119 },
        wallGroupId: 'Flur',
    },
    toilette: {
        highlight: null,
        bulb: null,
        presence: { type: 'text', cx: 287.5, cy: 150 },
        wallGroupId: 'Toilette',
    },
    badezimmer: {
        highlight: { shape: 'rect', x: 294.823, y: 128.977, w: 40.409, h: 36.972 },
        bulb: null,
        climate: { temp: { svgCx: 305, svgCy: 161 }, hum: { svgCx: 328, svgCy: 161 } },
        wallGroupId: 'Badezimmer',
    },
};
