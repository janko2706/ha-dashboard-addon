import React, { useMemo } from 'react';
import { ROOMS } from '../constants';
import { HAState, EntityConfig } from '../types';
import { SVGBackground } from './SVGBackground';
import { SVGOverlay } from './SVGOverlay';
import { TempAndHumidityDisplay } from './GaugeWidget';

interface Props {
    haStates: Record<string, HAState>;
    entityConfig: EntityConfig;
    humidityThreshold: number;
}

export const FloorPlanView: React.FC<Props> = ({ haStates, entityConfig, humidityThreshold }) => {
    const litRooms = useMemo(() => {
        const s = new Set<string>();
        Object.entries(entityConfig).forEach(([room, ents]) => {
            if (ents.light && haStates[ents.light]?.state === 'on') s.add(room);
        });
        return s;
    }, [haStates, entityConfig]);

    return (
        <div id="floorplan">
            <SVGBackground />
            <SVGOverlay
                haStates={haStates}
                entityConfig={entityConfig}
                humidityThreshold={humidityThreshold}
                litRooms={litRooms}
            />

            {Object.entries(ROOMS).map(([room, cfg]) => {
                if (!cfg.climate) return null;
                const ents = entityConfig[room] ?? {};
                const tempRaw = ents.temperature ? haStates[ents.temperature]?.state : undefined;
                const humRaw = ents.humidity ? haStates[ents.humidity]?.state : undefined;
                const tempVal = tempRaw != null ? parseFloat(tempRaw) : null;
                const humVal = humRaw != null ? parseFloat(humRaw) : null;

                return (
                    <React.Fragment key={room}>
                        <TempAndHumidityDisplay
                            svgCx={cfg.climate.temp.svgCx}
                            svgCy={cfg.climate.temp.svgCy}
                            value={tempVal}
                            min={-10} max={50}
                            thresholdV={25}
                            unit="°C"
                            kind="temp"
                        />
                        <TempAndHumidityDisplay
                            svgCx={cfg.climate.hum.svgCx}
                            svgCy={cfg.climate.hum.svgCy}
                            value={humVal}
                            min={0} max={100}
                            thresholdV={humidityThreshold}
                            unit="%"
                            kind="hum"
                        />
                    </React.Fragment>
                );
            })}
        </div>
    );
};
