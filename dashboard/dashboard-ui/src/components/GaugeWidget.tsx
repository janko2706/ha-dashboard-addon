import React from 'react';
import { FP_W, svgToScreen } from '../constants';

interface Props {
    svgCx: number;
    svgCy: number;
    value: number | null;
    min: number;
    max: number;
    thresholdV: number;
    unit: string;
    kind: 'temp' | 'hum';
}

function lerp(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}

// Cold → neutral gray → warm. All colors are heavily desaturated so it stays professional.
function tempColor(val: number): string {
    const cold = [100, 130, 158] as const; // muted steel blue
    const neutral = [148, 148, 148] as const; // plain gray at ~18°C
    const hot = [168, 110, 108] as const; // muted brick red

    if (val <= 18) {
        const t = Math.max(0, Math.min(1, (val + 10) / 28));
        return `rgb(${lerp(cold[0], neutral[0], t)},${lerp(cold[1], neutral[1], t)},${lerp(cold[2], neutral[2], t)})`;
    }
    const t = Math.max(0, Math.min(1, (val - 18) / 17));
    return `rgb(${lerp(neutral[0], hot[0], t)},${lerp(neutral[1], hot[1], t)},${lerp(neutral[2], hot[2], t)})`;
}

// Normal → muted red-gray as humidity climbs toward and past threshold.
function humColor(val: number, threshold: number): string {
    const normal = [128, 150, 150] as const; // muted teal-gray
    const alert = [168, 104, 104] as const; // muted red-gray

    // Transition starts 25 points below threshold, completes 5 points above it
    const t = Math.max(0, Math.min(1, (val - (threshold - 25)) / 30));
    return `rgb(${lerp(normal[0], alert[0], t)},${lerp(normal[1], alert[1], t)},${lerp(normal[2], alert[2], t)})`;
}

const SCALE = FP_W / 1920;
const W = 110 * SCALE; // widget width px

export const TempAndHumidityDisplay: React.FC<Props> = ({ svgCx, svgCy, value, min, max, thresholdV, unit, kind }) => {
    const pos = svgToScreen(svgCx, svgCy);

    const hasValue = value != null && !isNaN(value);
    const clamped = hasValue ? Math.max(min, Math.min(max, value!)) : 0;

    const display = hasValue
        ? (kind === 'temp' ? value!.toFixed(1) : Math.round(value!).toString())
        : '--';

    const color = hasValue
        ? (kind === 'temp' ? tempColor(clamped) : humColor(clamped, thresholdV))
        : '#444';

    return (
        <div
            style={{
                position: 'absolute',
                left: pos.x - W / 2,
                top: pos.y - 34 * SCALE,
                width: W,
                textAlign: 'center',
                pointerEvents: 'none',
                lineHeight: 1,
            }}
        >
            <div style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 60 * SCALE, fontWeight: 700, letterSpacing: 0 }}>{display}</span>
                <span style={{ fontSize: 28 * SCALE, fontWeight: 400, marginLeft: 3 * SCALE }}>{unit}</span>
            </div>
        </div>
    );
};
