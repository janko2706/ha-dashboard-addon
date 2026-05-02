import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { DashConfig, HAState } from '../types';

type PowerState = 'on' | 'off';

const ACTIVE_PRESENCE_STATES = new Set([
    'on',
    'home',
    'detected',
    'occupied',
    'present',
    'motion',
]);

const UNKNOWN_STATES = new Set(['unknown', 'unavailable']);

export function useDisplayPower(
    config: DashConfig | null,
    haStates: Record<string, HAState>,
) {
    const lastRequestedRef = useRef<PowerState | null>(null);
    const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const presenceEntityIds = useMemo(() => {
        if (!config?.entities) return [];
        const ids = Object.values(config.entities)
            .map(entitySet => entitySet.presence)
            .filter((entityId): entityId is string => Boolean(entityId));
        return [...new Set(ids)];
    }, [config]);

    const presenceStateSignature = presenceEntityIds
        .map(entityId => `${entityId}:${haStates[entityId]?.state ?? ''}`)
        .join('|');

    useEffect(() => {
        const powerConfig = config?.display_power;

        if (sleepTimerRef.current) {
            clearTimeout(sleepTimerRef.current);
            sleepTimerRef.current = null;
        }

        if (!powerConfig?.enabled || presenceEntityIds.length === 0) return;

        const states = presenceEntityIds.map(entityId => haStates[entityId]?.state);
        const hasActivePresence = states.some(isActivePresenceState);

        if (hasActivePresence) {
            void requestDisplayPower('on', lastRequestedRef);
            return;
        }

        const hasUnknownState = states.some(state => !state || UNKNOWN_STATES.has(state));
        if (hasUnknownState) return;

        const delayMs = Math.max(0, powerConfig.sleep_delay_seconds ?? 300) * 1000;
        sleepTimerRef.current = setTimeout(() => {
            void requestDisplayPower('off', lastRequestedRef);
        }, delayMs);

        return () => {
            if (sleepTimerRef.current) {
                clearTimeout(sleepTimerRef.current);
                sleepTimerRef.current = null;
            }
        };
    }, [
        config?.display_power?.enabled,
        config?.display_power?.sleep_delay_seconds,
        presenceEntityIds,
        presenceStateSignature,
    ]);
}

function isActivePresenceState(state: string | undefined): boolean {
    return Boolean(state && ACTIVE_PRESENCE_STATES.has(state));
}

async function requestDisplayPower(
    state: PowerState,
    lastRequestedRef: MutableRefObject<PowerState | null>,
) {
    if (lastRequestedRef.current === state) return;
    lastRequestedRef.current = state;

    try {
        const response = await fetch('/display/power', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state }),
        });

        if (!response.ok) {
            throw new Error(`/display/power ${response.status}`);
        }
    } catch (error) {
        lastRequestedRef.current = null;
        console.warn('Display power request failed', error);
    }
}
