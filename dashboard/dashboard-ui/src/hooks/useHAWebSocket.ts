import { useState, useEffect, useRef, useCallback } from 'react';
import { HAState, ConnectionStatus } from '../types';

export type HAStates = Record<string, HAState>;

interface Result {
  haStates: HAStates;
  status:   ConnectionStatus;
}

export function useHAWebSocket(haUrl: string, haToken: string): Result {
  const [haStates, setHAStates] = useState<HAStates>({});
  const [status,   setStatus]   = useState<ConnectionStatus>('connecting');

  // Keep a mutable ref so WS callbacks always see the latest state without stale closures.
  const statesRef      = useRef<HAStates>({});
  const wsRef          = useRef<WebSocket | null>(null);
  const msgIdRef       = useRef(1);
  const pendingRef     = useRef<Record<number, (msg: HAResult) => void>>({});
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    wsRef.current?.close();
    if (!haUrl || !haToken) return;

    const wsUrl = haUrl.replace(/^http/, 'ws') + '/api/websocket';
    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen    = () => setStatus('authenticating');
    ws.onerror   = () => setStatus('error');
    ws.onclose   = () => {
      setStatus('reconnecting');
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as HAMessage;

      switch (msg.type) {
        case 'auth_required':
          ws.send(JSON.stringify({ type: 'auth', access_token: haToken }));
          break;

        case 'auth_ok': {
          setStatus('connected');
          const id = msgIdRef.current++;
          ws.send(JSON.stringify({ id, type: 'get_states' }));
          pendingRef.current[id] = (r) => {
            if (!r.success) return;
            const next: HAStates = {};
            (r.result as HAState[]).forEach(s => { next[s.entity_id] = s; });
            statesRef.current = next;
            setHAStates({ ...next });
          };
          ws.send(JSON.stringify({
            id: msgIdRef.current++,
            type: 'subscribe_events',
            event_type: 'state_changed',
          }));
          break;
        }

        case 'auth_invalid':
          setStatus('invalid-token');
          break;

        case 'result': {
          const cb = pendingRef.current[(msg as HAResult).id];
          if (cb) { cb(msg as HAResult); delete pendingRef.current[(msg as HAResult).id]; }
          break;
        }

        case 'event': {
          const ev = (msg as HAEvent).event;
          if (ev.event_type === 'state_changed') {
            const { entity_id, new_state } = ev.data;
            const next = { ...statesRef.current };
            if (new_state) next[entity_id] = new_state;
            else delete next[entity_id];
            statesRef.current = next;
            setHAStates(next);
          }
          break;
        }
      }
    };
  }, [haUrl, haToken]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { haStates, status };
}

// ── Internal WS message types ──────────────────────────────────────────────

interface HAMessage  { type: string; }
interface HAResult   { type: 'result'; id: number; success: boolean; result: unknown; }
interface HAEvent    { type: 'event'; event: { event_type: string; data: { entity_id: string; new_state: HAState | null } }; }
