import { useState, useEffect } from 'react';
import { DashConfig, ConnectionStatus } from './types';
import { useHAWebSocket } from './hooks/useHAWebSocket';
import { useDisplayPower } from './hooks/useDisplayPower';
import { TopBar } from './components/TopBar';
import { FloorPlanView } from './components/FloorPlanView';
import { SunArc } from './components/SunArc';
import WeatherConditionsWidget from './components/weather-conditions-widget';

export default function App() {
    const [config, setConfig] = useState<DashConfig | null>(null);
    const [cfgError, setCfgError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/config')
            .then(r => { if (!r.ok) throw new Error(`/config → ${r.status}`); return r.json(); })
            .then((cfg: DashConfig) => {
                if (!cfg.ha_url || !cfg.ha_token)
                    setCfgError('Set ha_url + ha_token in add-on options, then restart.');
                else
                    setConfig(cfg);
            })
            .catch((e: Error) => setCfgError(e.message));
    }, []);

    const { haStates, status } = useHAWebSocket(
        config?.ha_url ?? '',
        config?.ha_token ?? '',
    );
    useDisplayPower(config, haStates);

    const wsStatus: ConnectionStatus = config ? status : 'connecting';

    if (cfgError) {
        return (
            <>
                <TopBar status="error" />
                <div className="cfg-error">
                    <strong>Config error:</strong> {cfgError}
                </div>
            </>
        );
    }

    return (
        <>
            <TopBar status={wsStatus} />
            {config && (
                <main className="dashboard-main">
                    <SunArc />
                    <div className="cards-row">
                        <WeatherConditionsWidget />
                        <div className="floorplan-area">
                            <FloorPlanView
                                haStates={haStates}
                                entityConfig={config.entities ?? {}}
                                humidityThreshold={config.humidity_threshold ?? 70}
                            />
                        </div>
                    </div>
                </main>
            )}
        </>
    );
}
