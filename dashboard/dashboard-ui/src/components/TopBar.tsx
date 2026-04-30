import React from 'react';
import { useClock } from '../hooks/useClock';
import { ConnectionStatus } from '../types';

const LABEL: Record<ConnectionStatus, string> = {
  'connecting':    'Connecting…',
  'authenticating': 'Authenticating…',
  'connected':     'Connected',
  'error':         'Connection error',
  'reconnecting':  'Reconnecting…',
  'invalid-token': 'Invalid token — check add-on config',
};

const CLS: Record<ConnectionStatus, string> = {
  'connecting':    '',
  'authenticating': '',
  'connected':     'status--ok',
  'error':         'status--error',
  'reconnecting':  'status--warn',
  'invalid-token': 'status--error',
};

export const TopBar: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const time = useClock();
  return (
    <header className="topbar">
      <span className="topbar__title">Home</span>
      <span className="topbar__time">{time}</span>
      <span className={`topbar__status ${CLS[status]}`}>{LABEL[status]}</span>
    </header>
  );
};
