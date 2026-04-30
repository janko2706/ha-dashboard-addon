import React, { useEffect, useMemo, useState } from 'react';
import { HAState } from '../types';

type WeatherKind =
  | 'sunny'
  | 'night'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'stormy'
  | 'foggy'
  | 'windy'
  | 'unknown';

interface WeatherCondition {
  kind: WeatherKind;
  label: string;
}

interface WeatherSnapshot extends WeatherCondition {
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  windSpeed: number | null;
  windGust: number | null;
  updatedAt: string | null;
}

interface WeatherDay extends WeatherCondition {
  date: string;
  high: number | null;
  low: number | null;
  precipitation: number | null;
  windSpeed: number | null;
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

interface WeatherData {
  current: WeatherSnapshot | null;
  days: WeatherDay[];
}

interface Props {
  haStates: Record<string, HAState>;
  weatherEntity?: string;
}

const ROHR_LAT = 48.07;
const ROHR_LON = 14.19;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const MISSING_STATES = new Set(['unknown', 'unavailable', 'none', '']);

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${ROHR_LAT}` +
  `&longitude=${ROHR_LON}` +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' +
  '&forecast_days=3' +
  '&timezone=Europe%2FVienna' +
  '&wind_speed_unit=kmh' +
  '&precipitation_unit=mm';

const HA_CONDITIONS: Record<string, WeatherCondition> = {
  'clear-night': { kind: 'night', label: 'Clear night' },
  cloudy: { kind: 'cloudy', label: 'Cloudy' },
  exceptional: { kind: 'stormy', label: 'Severe weather' },
  fog: { kind: 'foggy', label: 'Foggy' },
  hail: { kind: 'stormy', label: 'Hail' },
  lightning: { kind: 'stormy', label: 'Thunderstorms' },
  'lightning-rainy': { kind: 'stormy', label: 'Thunderstorms with rain' },
  partlycloudy: { kind: 'cloudy', label: 'Partly cloudy' },
  pouring: { kind: 'rainy', label: 'Heavy rain' },
  rainy: { kind: 'rainy', label: 'Rainy' },
  snowy: { kind: 'snowy', label: 'Snowy' },
  'snowy-rainy': { kind: 'snowy', label: 'Sleet' },
  sunny: { kind: 'sunny', label: 'Sunny' },
  windy: { kind: 'windy', label: 'Windy' },
  'windy-variant': { kind: 'windy', label: 'Windy and cloudy' },
};

function wmoCondition(code: number | undefined, windSpeed?: number | null, gust?: number | null): WeatherCondition {
  const base: WeatherCondition = (() => {
    switch (code) {
      case 0: return { kind: 'sunny', label: 'Sunny' };
      case 1: return { kind: 'sunny', label: 'Mostly sunny' };
      case 2: return { kind: 'cloudy', label: 'Partly cloudy' };
      case 3: return { kind: 'cloudy', label: 'Cloudy' };
      case 45:
      case 48: return { kind: 'foggy', label: 'Foggy' };
      case 51:
      case 53:
      case 55: return { kind: 'rainy', label: 'Drizzle' };
      case 56:
      case 57: return { kind: 'rainy', label: 'Freezing drizzle' };
      case 61: return { kind: 'rainy', label: 'Light rain' };
      case 63: return { kind: 'rainy', label: 'Rainy' };
      case 65: return { kind: 'rainy', label: 'Heavy rain' };
      case 66:
      case 67: return { kind: 'rainy', label: 'Freezing rain' };
      case 71: return { kind: 'snowy', label: 'Light snow' };
      case 73: return { kind: 'snowy', label: 'Snowy' };
      case 75: return { kind: 'snowy', label: 'Heavy snow' };
      case 77: return { kind: 'snowy', label: 'Snow grains' };
      case 80: return { kind: 'rainy', label: 'Rain showers' };
      case 81: return { kind: 'rainy', label: 'Strong rain showers' };
      case 82: return { kind: 'rainy', label: 'Violent rain showers' };
      case 85:
      case 86: return { kind: 'snowy', label: 'Snow showers' };
      case 95: return { kind: 'stormy', label: 'Thunderstorms' };
      case 96:
      case 99: return { kind: 'stormy', label: 'Thunderstorms with hail' };
      default: return { kind: 'unknown', label: 'Weather updating' };
    }
  })();

  const windy = (windSpeed ?? 0) >= 30 || (gust ?? 0) >= 45;
  if (!windy || ['rainy', 'snowy', 'stormy', 'foggy'].includes(base.kind)) return base;
  return { kind: 'windy', label: base.kind === 'sunny' ? `Windy and ${base.label.toLowerCase()}` : `Windy, ${base.label.toLowerCase()}` };
}

function numberFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isUsableState(state: string | undefined): state is string {
  return state != null && !MISSING_STATES.has(state.toLowerCase());
}

function formatTemp(value: number | null): string {
  return value == null ? '--' : `${Math.round(value)}°`;
}

function formatWind(value: number | null): string {
  return value == null ? '--' : `${Math.round(value)} km/h`;
}

function formatPrecip(value: number | null): string {
  if (value == null) return '--';
  if (value < 0.1) return '0 mm';
  return `${value.toFixed(value < 10 ? 1 : 0)} mm`;
}

function dateKeyInVienna(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function dayOffsetInVienna(daysFromToday: number): string {
  return dateKeyInVienna(new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000));
}

function dayLabel(date: string): string {
  if (date === dayOffsetInVienna(1)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(`${date}T12:00:00`));
}

function buildCurrentDescription(weather: WeatherSnapshot): string {
  const details: string[] = [];
  if (weather.apparentTemperature != null) details.push(`feels like ${formatTemp(weather.apparentTemperature)}`);
  if (weather.humidity != null) details.push(`${Math.round(weather.humidity)}% humidity`);
  if (weather.windSpeed != null) details.push(`${formatWind(weather.windSpeed)} wind`);
  if (weather.precipitation != null && weather.precipitation >= 0.1) {
    details.push(`${formatPrecip(weather.precipitation)} precipitation`);
  } else if (weather.cloudCover != null) {
    details.push(`${Math.round(weather.cloudCover)}% cloud cover`);
  }

  return details.length > 0 ? details.join(' · ') : 'Live outside conditions';
}

function buildDayDescription(day: WeatherDay): string {
  const details: string[] = [];
  if (day.precipitation != null) details.push(`${formatPrecip(day.precipitation)} precipitation`);
  if (day.windSpeed != null) details.push(`wind up to ${formatWind(day.windSpeed)}`);
  return details.length > 0 ? details.join(' · ') : 'Forecast updating';
}

function parseOpenMeteo(data: OpenMeteoResponse): WeatherData {
  const currentCondition = wmoCondition(
    data.current?.weather_code,
    data.current?.wind_speed_10m,
    data.current?.wind_gusts_10m,
  );

  const current = data.current
    ? {
      ...currentCondition,
      temperature: numberFrom(data.current.temperature_2m),
      apparentTemperature: numberFrom(data.current.apparent_temperature),
      humidity: numberFrom(data.current.relative_humidity_2m),
      precipitation: numberFrom(data.current.precipitation),
      cloudCover: numberFrom(data.current.cloud_cover),
      windSpeed: numberFrom(data.current.wind_speed_10m),
      windGust: numberFrom(data.current.wind_gusts_10m),
      updatedAt: data.current.time ?? null,
    }
    : null;

  const days: WeatherDay[] = [];
  const times = data.daily?.time ?? [];
  for (let i = 1; i < Math.min(times.length, 3); i += 1) {
    days.push({
      ...wmoCondition(
        data.daily?.weather_code?.[i],
        data.daily?.wind_speed_10m_max?.[i],
        null,
      ),
      date: times[i],
      high: numberFrom(data.daily?.temperature_2m_max?.[i]),
      low: numberFrom(data.daily?.temperature_2m_min?.[i]),
      precipitation: numberFrom(data.daily?.precipitation_sum?.[i]),
      windSpeed: numberFrom(data.daily?.wind_speed_10m_max?.[i]),
    });
  }

  return { current, days };
}

function currentFromHA(state: HAState | null): WeatherSnapshot | null {
  if (!state || !isUsableState(state.state)) return null;
  const condition = HA_CONDITIONS[state.state] ?? { kind: 'unknown' as const, label: state.state.replace(/-/g, ' ') };
  const datetime = state.attributes.datetime;

  return {
    ...condition,
    temperature: numberFrom(state.attributes.temperature),
    apparentTemperature: numberFrom(state.attributes.apparent_temperature),
    humidity: numberFrom(state.attributes.humidity),
    precipitation: numberFrom(state.attributes.precipitation),
    cloudCover: numberFrom(state.attributes.cloud_coverage),
    windSpeed: numberFrom(state.attributes.wind_speed),
    windGust: numberFrom(state.attributes.wind_gust_speed),
    updatedAt: typeof datetime === 'string' ? datetime : null,
  };
}

function forecastFromHA(state: HAState | null): WeatherDay[] {
  const forecast = state?.attributes.forecast;
  if (!Array.isArray(forecast)) return [];
  const today = dayOffsetInVienna(0);

  return forecast.slice(0, 6).reduce<WeatherDay[]>((days, entry) => {
    if (typeof entry !== 'object' || entry == null) return days;
    const item = entry as Record<string, unknown>;
    const date = String(item.datetime ?? item.time ?? '');
    const dateKey = date.slice(0, 10);
    if (!dateKey || dateKey <= today) return days;
    const conditionKey = String(item.condition ?? '');
    const condition = HA_CONDITIONS[conditionKey] ?? { kind: 'unknown' as const, label: conditionKey.replace(/-/g, ' ') || 'Forecast' };

    days.push({
      ...condition,
      date: dateKey,
      high: numberFrom(item.temperature),
      low: numberFrom(item.templow),
      precipitation: numberFrom(item.precipitation),
      windSpeed: numberFrom(item.wind_speed),
    });
    return days;
  }, []).slice(0, 2);
}

const WeatherIcon: React.FC<{ kind: WeatherKind }> = ({ kind }) => {
  const cloud = <path d="M21 45h25a10 10 0 0 0 1-20 15 15 0 0 0-28-4A12 12 0 0 0 21 45Z" />;
  const sun = (
    <>
      <circle cx="31" cy="28" r="10" />
      <path d="M31 8v7M31 41v7M11 28h7M44 28h7M17 14l5 5M40 37l5 5M45 14l-5 5M22 37l-5 5" />
    </>
  );

  return (
    <svg className={`weather-icon weather-icon--${kind}`} viewBox="0 0 64 64" aria-hidden="true">
      {kind === 'sunny' && sun}
      {kind === 'night' && <path d="M43 43a21 21 0 0 1-21-21 18 18 0 1 0 21 21Z" />}
      {kind === 'cloudy' && cloud}
      {kind === 'rainy' && (
        <>
          {cloud}
          <path d="M25 51l-3 6M35 51l-3 6M45 51l-3 6" />
        </>
      )}
      {kind === 'snowy' && (
        <>
          {cloud}
          <path d="M24 53h6M27 50v6M39 53h6M42 50v6" />
        </>
      )}
      {kind === 'stormy' && (
        <>
          {cloud}
          <path d="M35 48l-5 10h7l-3 8 10-14h-7l3-4Z" />
        </>
      )}
      {kind === 'foggy' && (
        <>
          {cloud}
          <path d="M16 51h33M20 57h25" />
        </>
      )}
      {kind === 'windy' && <path d="M12 24h29a7 7 0 1 0-7-7M13 35h38a6 6 0 1 1-6 6M15 46h20" />}
      {kind === 'unknown' && (
        <>
          <circle cx="32" cy="32" r="20" />
          <path d="M32 42v1M27 26a6 6 0 1 1 9 5c-3 2-4 3-4 7" />
        </>
      )}
    </svg>
  );
};

export const WeatherPanel: React.FC<Props> = ({ haStates, weatherEntity }) => {
  const [weatherData, setWeatherData] = useState<WeatherData>({ current: null, days: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWeather = () => {
      fetch(OPEN_METEO_URL)
        .then((response) => {
          if (!response.ok) throw new Error(`Weather API ${response.status}`);
          return response.json() as Promise<OpenMeteoResponse>;
        })
        .then((data) => {
          if (cancelled) return;
          setWeatherData(parseOpenMeteo(data));
          setError(null);
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        });
    };

    loadWeather();
    const interval = window.setInterval(loadWeather, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const haWeather = useMemo(() => {
    if (!weatherEntity) return null;
    const state = haStates[weatherEntity];
    return state && isUsableState(state.state) ? state : null;
  }, [haStates, weatherEntity]);

  const haForecast = useMemo(() => forecastFromHA(haWeather), [haWeather]);
  const current = currentFromHA(haWeather) ?? weatherData.current;
  const days = haForecast.length > 0 ? haForecast : weatherData.days;

  return (
    <section className="weather-panel" aria-label="Weather forecast for Rohr im Kremstal">
      <div className="weather-panel__header">
        <p className="weather-panel__eyebrow">Outside</p>
        <h2>Rohr im Kremstal</h2>
      </div>

      <div className="weather-current">
        <div className="weather-current__icon">
          <WeatherIcon kind={current?.kind ?? 'unknown'} />
        </div>
        <div className="weather-current__reading">
          <span className="weather-current__temp">{formatTemp(current?.temperature ?? null)}</span>
          <span className="weather-current__condition">{current?.label ?? 'Weather loading'}</span>
        </div>
      </div>

      <p className="weather-current__description">
        {current ? buildCurrentDescription(current) : (error ?? 'Loading current outside conditions')}
      </p>

      <div className="weather-metrics">
        <div>
          <span>Humidity</span>
          <strong>{current?.humidity != null ? `${Math.round(current.humidity)}%` : '--'}</strong>
        </div>
        <div>
          <span>Wind</span>
          <strong>{formatWind(current?.windSpeed ?? null)}</strong>
        </div>
        <div>
          <span>Rain</span>
          <strong>{formatPrecip(current?.precipitation ?? null)}</strong>
        </div>
      </div>

      <div className="weather-forecast">
        <div className="weather-forecast__title">Next two days</div>
        {days.slice(0, 2).map((day) => (
          <div className="weather-day" key={`${day.date}-${day.label}`}>
            <WeatherIcon kind={day.kind} />
            <div className="weather-day__body">
              <div className="weather-day__topline">
                <span>{dayLabel(day.date)}</span>
                <strong>{formatTemp(day.high)} / {formatTemp(day.low)}</strong>
              </div>
              <div className="weather-day__condition">{day.label}</div>
              <div className="weather-day__detail">{buildDayDescription(day)}</div>
            </div>
          </div>
        ))}
        {days.length === 0 && (
          <div className="weather-day weather-day--empty">
            <WeatherIcon kind="unknown" />
            <div className="weather-day__body">
              <div className="weather-day__topline">
                <span>Forecast</span>
                <strong>-- / --</strong>
              </div>
              <div className="weather-day__detail">{error ?? 'Forecast loading'}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
