import React, { useEffect, useState, useMemo } from 'react';

// ── Location & display orientation ────────────────────────────────────────
const LAT = 48.07;   // Rohr im Kremstal
const LON = 14.19;
const DISPLAY_BACK_AZ = 156;        // back of display faces 156° SE
const FOV_LEFT = DISPLAY_BACK_AZ - 90;  // 66° ENE  → left edge
const FOV_RIGHT = DISPLAY_BACK_AZ + 90;  // 246° WSW → right edge
const FOV_SPAN = FOV_RIGHT - FOV_LEFT;  // 180°

// ── SVG canvas ────────────────────────────────────────────────────────────
const SVG_W = 1808;   // 1920px − 2×56px padding
const SVG_H = 90;
const LINE_Y = 72;     // horizon line y-position
const MAX_ALT = 65;     // altitude ceiling for vertical scaling (°)

// ── Sun position (USNO algorithm) ─────────────────────────────────────────
function sunPos(date: Date): { az: number; alt: number } {
    const r = Math.PI / 180;
    const JD = date.getTime() / 86400000 + 2440587.5;
    const n = JD - 2451545.0;

    const L = ((280.46646 + 36000.76983 * n / 36525) % 360 + 360) % 360;
    const Md = ((357.52911 + 35999.05029 * n / 36525) % 360 + 360) % 360;
    const M = Md * r;

    const C = (1.914602 - 0.004817 * n / 36525) * Math.sin(M)
        + 0.019993 * Math.sin(2 * M)
        + 0.000289 * Math.sin(3 * M);

    const slr = ((L + C + 360) % 360) * r;
    const eps = (23.43929111 - 0.013004167 * n / 36525) * r;

    const RA = Math.atan2(Math.cos(eps) * Math.sin(slr), Math.cos(slr));
    const dec = Math.asin(Math.sin(eps) * Math.sin(slr));

    const GMST = ((280.46061837 + 360.98564736629 * n) % 360 + 360) % 360;
    const H = ((GMST + LON + 360) % 360) * r - RA;

    const lr = LAT * r;
    const sAlt = Math.sin(lr) * Math.sin(dec) + Math.cos(lr) * Math.cos(dec) * Math.cos(H);
    const altR = Math.asin(Math.max(-1, Math.min(1, sAlt)));
    const cAlt = Math.cos(altR);

    let az = 0;
    if (cAlt > 1e-10) {
        const sAz = -Math.cos(dec) * Math.sin(H) / cAlt;
        const cAz = (Math.sin(dec) - Math.sin(lr) * sAlt) / (Math.cos(lr) * cAlt);
        az = ((Math.atan2(sAz, cAz) / r) + 360) % 360;
    }
    return { az, alt: altR / r };
}

// ── Moon position (Meeus simplified, ~1° accuracy) ────────────────────────
function moonPos(date: Date): { az: number; alt: number; phase: number } {
    const r = Math.PI / 180;
    const JD = date.getTime() / 86400000 + 2440587.5;
    const n = JD - 2451545.0;

    // Mean elements
    const Lm = ((218.316 + 13.176396 * n) % 360 + 360) % 360; // mean longitude
    const Mm = ((134.963 + 13.064993 * n) % 360 + 360) % 360; // mean anomaly
    const Fm = ((93.272 + 13.229350 * n) % 360 + 360) % 360; // arg of latitude

    // Sun's mean anomaly and longitude (for perturbation corrections)
    const Ms = ((357.529 + 0.985600 * n) % 360 + 360) % 360;
    const Ls = ((280.459 + 0.985647 * n) % 360 + 360) % 360;

    // Corrections to mean anomaly (evection + annual equation)
    const Ev = 1.2739 * Math.sin((2 * (Lm - Ls) - Mm) * r);
    const Ae = -0.1858 * Math.sin(Ms * r);
    const A3 = -0.0370 * Math.sin(Ms * r);
    const Mmc = Mm + Ev + Ae + A3;

    // Corrected longitude
    const Ec = 6.2886 * Math.sin(Mmc * r);
    const A4 = 0.2140 * Math.sin(2 * Mmc * r);
    const Lc = Lm + Ev + Ec - Ae + A4;
    const V = 0.6583 * Math.sin(2 * (Lc - Ls) * r);
    const Ltrue = Lc + V;  // true ecliptic longitude

    // Ecliptic latitude
    const Fc = Fm + Ev - Ae - 0.0300 * Math.sin(Ms * r);
    const Bm = 5.1282 * Math.sin(Fc * r);  // degrees

    // Ecliptic → equatorial (same obliquity as sun)
    const eps = (23.43929111 - 0.013004167 * n / 36525) * r;
    const Lr = Ltrue * r;
    const Br = Bm * r;

    const RA = Math.atan2(
        Math.sin(Lr) * Math.cos(eps) - Math.tan(Br) * Math.sin(eps),
        Math.cos(Lr),
    );
    const dec = Math.asin(
        Math.sin(Br) * Math.cos(eps) + Math.cos(Br) * Math.sin(eps) * Math.sin(Lr),
    );

    // Hour angle → altitude + azimuth
    const GMST = ((280.46061837 + 360.98564736629 * n) % 360 + 360) % 360;
    const H = ((GMST + LON + 360) % 360) * r - RA;
    const lr = LAT * r;

    const sAlt = Math.sin(lr) * Math.sin(dec) + Math.cos(lr) * Math.cos(dec) * Math.cos(H);
    const altR = Math.asin(Math.max(-1, Math.min(1, sAlt)));
    const cAlt = Math.cos(altR);

    let az = 0;
    if (cAlt > 1e-10) {
        const sAz = -Math.cos(dec) * Math.sin(H) / cAlt;
        const cAz = (Math.sin(dec) - Math.sin(lr) * sAlt) / (Math.cos(lr) * cAlt);
        az = ((Math.atan2(sAz, cAz) / r) + 360) % 360;
    }

    // Phase: elongation / 360  (0 = new, 0.5 = full)
    const phase = ((Ltrue - Ls + 360) % 360) / 360;

    return { az, alt: altR / r, phase };
}

// ── Moon phase SVG path ───────────────────────────────────────────────────
// Returns the fill path of the illuminated portion (disc centred at cx,cy radius R).
// Uses the standard two-arc trick: outer limb + elliptical terminator.
function moonPhasePath(cx: number, cy: number, R: number, phase: number): string {
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.02 || p > 0.98) return ''; // new moon — essentially dark

    // k: cos of elongation. +1 at new, −1 at full, back to +1 at new.
    const k = Math.cos(p * 2 * Math.PI);
    const tx = R * Math.abs(k);  // x-radius of terminator ellipse

    if (p <= 0.5) {
        // Waxing: right limb (CW) + terminator back
        const sw = k > 0 ? 0 : 1;  // CCW crescent → CW gibbous
        return `M${cx},${cy - R} A${R},${R},0,0,1,${cx},${cy + R} A${tx},${R},0,0,${sw},${cx},${cy - R}`;
    } else {
        // Waning: left limb (CCW) + terminator back
        const sw = k > 0 ? 1 : 0;  // CW crescent → CCW gibbous
        return `M${cx},${cy - R} A${R},${R},0,0,0,${cx},${cy + R} A${tx},${R},0,0,${sw},${cx},${cy - R}`;
    }
}

// ── Coordinate mapping ────────────────────────────────────────────────────
function azToX(az: number) {
    return ((az - FOV_LEFT) / FOV_SPAN) * SVG_W;
}
function altToY(alt: number) {
    const t = Math.max(0, Math.min(MAX_ALT, alt)) / MAX_ALT;
    return LINE_Y - t * (LINE_Y - 10);
}

// ── Arc sample helpers ────────────────────────────────────────────────────
interface ArcPt { x: number; y: number; alt: number; min: number; }

function buildArc(date: Date) {
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);

    const pts: ArcPt[] = [];
    let sunrise: Date | null = null;
    let sunset: Date | null = null;
    let prev = false;

    for (let m = 0; m <= 24 * 60; m += 4) {
        const t = new Date(base.getTime() + m * 60_000);
        const { az, alt } = sunPos(t);
        const up = alt > 0;
        if (!prev && up) sunrise = new Date(t);
        if (prev && !up) sunset = new Date(t);
        prev = up;
        if (up) pts.push({ x: azToX(az), y: altToY(alt), alt, min: m });
    }
    return { pts, sunrise, sunset };
}

function buildMoonArc(date: Date) {
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);

    const pts: ArcPt[] = [];
    let moonrise: Date | null = null;
    let moonset: Date | null = null;
    let prev = false;

    for (let m = 0; m <= 24 * 60; m += 4) {
        const t = new Date(base.getTime() + m * 60_000);
        const { az, alt } = moonPos(t);
        const up = alt > 0;
        if (!prev && up) moonrise = new Date(t);
        if (prev && !up) moonset = new Date(t);
        prev = up;
        if (up) pts.push({ x: azToX(az), y: altToY(alt), alt, min: m });
    }
    return { pts, moonrise, moonset };
}

function fmt(d: Date | null) {
    if (!d) return '--:--';
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const COMPASS = [
    { az: 90, lbl: 'E' },
    { az: 135, lbl: 'SE' },
    { az: 180, lbl: 'S' },
    { az: 225, lbl: 'SW' },
];

// ── Component ─────────────────────────────────────────────────────────────
export const SunArc: React.FC = () => {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const today = now.toDateString();

    const { pts, sunrise, sunset } = useMemo(() => buildArc(now), [today]);
    const { pts: mPts, moonrise, moonset } = useMemo(() => buildMoonArc(now), [today]);

    // ── Sun ──
    const { az: curAz, alt: curAlt } = sunPos(now);
    const cx = azToX(curAz);
    const cy = curAlt > 0 ? altToY(curAlt) : LINE_Y;
    const isDay = curAlt > 0;

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const past = pts.filter(p => p.min <= nowMin);
    const future = pts.filter(p => p.min >= nowMin);

    // ── Moon ──
    const { az: moonAz, alt: moonAlt, phase: moonPhase } = moonPos(now);
    const mx = azToX(moonAz);
    const my = moonAlt > 0 ? altToY(moonAlt) : LINE_Y;
    const isMoonUp = moonAlt > 0;

    const moonPast = mPts.filter(p => p.min <= nowMin);
    const moonFuture = mPts.filter(p => p.min >= nowMin);

    const toPath = (arr: ArcPt[]) =>
        arr.length > 1 ? 'M' + arr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') : '';

    const litPath = moonPhasePath(mx, my, 9, moonPhase);

    return (
        <svg
            className="sun-arc"
            width={SVG_W}
            height={SVG_H}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            aria-label="Sun and moon position arc"
        >
            <defs>
                {/* ── Sun gradients / filters ── */}
                <linearGradient id="futureArcGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fef9c3" stopOpacity="1" />
                    <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <filter id="sunGlow" x="-120%" y="-120%" width="340%" height="340%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                {/* ── Moon gradients / filters ── */}
                <linearGradient id="moonFutureGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                    <stop offset="0%" stopColor="#445568" />
                    <stop offset="50%" stopColor="#8090b8" />
                    <stop offset="100%" stopColor="#445568" />
                </linearGradient>
                <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#c8d8f0" stopOpacity="0.45" />
                    <stop offset="55%" stopColor="#7090c0" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#5070a0" stopOpacity="0" />
                </radialGradient>
                <filter id="moonGlow" x="-120%" y="-120%" width="340%" height="340%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* ── Horizon line ──────────────────────────────────────────── */}
            <line x1={0} y1={LINE_Y} x2={SVG_W} y2={LINE_Y} stroke="#252525" strokeWidth={1} />

            {/* ── Compass ticks ─────────────────────────────────────────── */}
            {COMPASS.map(({ az, lbl }) => {
                const x = azToX(az);
                return (
                    <g key={az}>
                        <line x1={x} y1={LINE_Y - 4} x2={x} y2={LINE_Y + 4} stroke="#2e2e2e" strokeWidth={1} />
                        <text x={x} y={SVG_H - 1} fontSize={11} fill="#363636" textAnchor="middle"
                            fontFamily="DejaVu Sans, Noto Sans, sans-serif">
                            {lbl}
                        </text>
                    </g>
                );
            })}

            {/* ════════════════ MOON (night only) ═════════════════════════ */}
            {!isDay && (
                <>
                    {/* Past moon arc */}
                    {toPath(moonPast) && (
                        <path d={toPath(moonPast)} fill="none"
                            stroke="#2a3545" strokeWidth={1.5} strokeOpacity={0.5} strokeLinejoin="round" />
                    )}
                    {/* Future moon arc */}
                    {toPath(moonFuture) && (
                        <path d={toPath(moonFuture)} fill="none"
                            stroke="url(#moonFutureGrad)" strokeWidth={2} strokeOpacity={0.6} strokeLinejoin="round" />
                    )}

                    {/* Drop line from moon to horizon */}
                    {isMoonUp && my < LINE_Y - 6 && (
                        <line x1={mx} y1={my + 14} x2={mx} y2={LINE_Y}
                            stroke="#8090b8" strokeWidth={1} strokeOpacity={0.18} strokeDasharray="3 5" />
                    )}

                    {/* Moon icon at current position */}
                    {isMoonUp && (
                        <>
                            {/* halo */}
                            <circle cx={mx} cy={my} r={28} fill="url(#moonHalo)" />
                            {/* dark disc base */}
                            <circle cx={mx} cy={my} r={9} fill="#111827" filter="url(#moonGlow)" />
                            {/* illuminated portion */}
                            {litPath && <path d={litPath} fill="#c8d8f0" />}
                            {/* disc outline */}
                            <circle cx={mx} cy={my} r={9} fill="none" stroke="#4a5a7a" strokeWidth={0.75} />
                        </>
                    )}

                    {/* Moonrise / moonset labels */}
                    {moonrise && (
                        <text x={10} y={LINE_Y - 5} fontSize={12} fill="#354060"
                            fontFamily="DejaVu Sans, Noto Sans, sans-serif">
                            ↑ {fmt(moonrise)}
                        </text>
                    )}
                    {moonset && (
                        <text x={SVG_W - 10} y={LINE_Y - 5} fontSize={12} fill="#354060"
                            textAnchor="end" fontFamily="DejaVu Sans, Noto Sans, sans-serif">
                            {fmt(moonset)} ↓
                        </text>
                    )}
                </>
            )}

            {/* ════════════════ SUN (daytime) ══════════════════════════════ */}
            {/* Past arc */}
            {toPath(past) && (
                <path d={toPath(past)} fill="none"
                    stroke="#7c5a0e" strokeWidth={2} strokeOpacity={0.45} strokeLinejoin="round" />
            )}
            {/* Future arc */}
            {toPath(future) && (
                <path d={toPath(future)} fill="none"
                    stroke="url(#futureArcGrad)" strokeWidth={2.5} strokeOpacity={0.65} strokeLinejoin="round" />
            )}

            {isDay && (
                <>
                    {/* Drop line */}
                    {cy < LINE_Y - 6 && (
                        <line x1={cx} y1={cy + 14} x2={cx} y2={LINE_Y}
                            stroke="#fbbf24" strokeWidth={1} strokeOpacity={0.18} strokeDasharray="3 5" />
                    )}
                    {/* Halo */}
                    <circle cx={cx} cy={cy} r={34} fill="url(#sunHalo)" />
                    {/* Rays */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
                        const a = deg * Math.PI / 180;
                        return (
                            <line key={deg}
                                x1={cx + 13 * Math.cos(a)} y1={cy + 13 * Math.sin(a)}
                                x2={cx + 22 * Math.cos(a)} y2={cy + 22 * Math.sin(a)}
                                stroke="#fcd34d" strokeWidth={1.5} strokeLinecap="round" opacity={0.75}
                            />
                        );
                    })}
                    {/* Glow core */}
                    <circle cx={cx} cy={cy} r={9} fill="#fef9c3" filter="url(#sunGlow)" />
                    <circle cx={cx} cy={cy} r={7} fill="#fef08a" />
                </>
            )}

            {/* ── Sunrise/sunset labels (daytime only) ──────────────────── */}
            {isDay && (
                <>
                    <text x={10} y={LINE_Y - 5} fontSize={12} fill="#5a4a22"
                        fontFamily="DejaVu Sans, Noto Sans, sans-serif">
                        ↑ {fmt(sunrise)}
                    </text>
                    <text x={SVG_W - 10} y={LINE_Y - 5} fontSize={12} fill="#5a4a22"
                        textAnchor="end" fontFamily="DejaVu Sans, Noto Sans, sans-serif">
                        {fmt(sunset)} ↓
                    </text>
                </>
            )}
        </svg>
    );
};
