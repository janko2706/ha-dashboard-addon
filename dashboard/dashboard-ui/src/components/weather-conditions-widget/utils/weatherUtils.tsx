import React from 'react';
import { WeatherData } from '../types/weatherTypes';
import styles from '../styles.module.css';

export interface DailyForecast {
  date: string;
  label: string;
  high: number;
  low: number;
  weatherCode: number;
}

export function getWeatherIcon(weatherCode: number, isNight = false): React.ReactElement {
  const cloud = <path d="M19 45h27a10 10 0 0 0 1-20 15 15 0 0 0-28-4A12 12 0 0 0 19 45Z" />;
  const sun = (
    <>
      <circle cx="30" cy="27" r="10" />
      <path d="M30 7v7M30 40v7M10 27h7M43 27h7M16 13l5 5M39 36l5 5M44 13l-5 5M21 36l-5 5" />
    </>
  );
  const moon = <path d="M43 43a21 21 0 0 1-21-21 18 18 0 1 0 21 21Z" />;

  const icon = (() => {
    if (weatherCode <= 1) return isNight ? moon : sun;
    if (weatherCode <= 3) {
      return (
        <>
          {cloud}
          {isNight ? <path d="M43 21a12 12 0 0 1-12-12 10 10 0 1 0 12 12Z" /> : null}
        </>
      );
    }
    if (weatherCode <= 67) {
      return (
        <>
          {cloud}
          <path d="M25 51l-3 6M35 51l-3 6M45 51l-3 6" />
        </>
      );
    }
    if (weatherCode <= 77) {
      return (
        <>
          {cloud}
          <path d="M24 54h6M27 51v6M39 54h6M42 51v6" />
        </>
      );
    }
    if (weatherCode <= 82) {
      return (
        <>
          {cloud}
          <path d="M25 51l-3 6M35 51l-3 6M45 51l-3 6" />
        </>
      );
    }
    if (weatherCode <= 99) {
      return (
        <>
          {cloud}
          <path d="M35 48l-5 10h7l-3 8 10-14h-7l3-4Z" />
        </>
      );
    }
    return cloud;
  })();

  return (
    <svg className={styles.iconGlyph} viewBox="0 0 64 64" aria-hidden="true">
      {icon}
    </svg>
  );
}

export function getConditionText(weatherCode: number, isNight = false): string {
  if (weatherCode <= 1) return isNight ? 'Clear night' : 'Clear';
  if (weatherCode <= 3) return 'Partly cloudy';
  if (weatherCode <= 45) return 'Cloudy';
  if (weatherCode <= 48) return 'Foggy';
  if (weatherCode <= 57) return 'Drizzle';
  if (weatherCode <= 67) return 'Rain';
  if (weatherCode <= 77) return 'Snow';
  if (weatherCode <= 82) return 'Rain showers';
  if (weatherCode <= 99) return 'Thunderstorm';
  return 'Weather updating';
}

export function getWeatherBackgroundClass(weatherCode: number, css: typeof styles, isNight = false): string {
  if (isNight && weatherCode <= 3) return css.nightBackground;
  if (weatherCode <= 1) return css.sunnyBackground;
  if (weatherCode <= 3) return css.cloudyBackground;
  if (weatherCode <= 45) return css.overcastBackground;
  if (weatherCode <= 67) return css.rainyBackground;
  if (weatherCode <= 77) return css.snowyBackground;
  if (weatherCode <= 99) return css.stormyBackground;
  return css.defaultBackground;
}

export function formatTemp(temp: number | undefined): string {
  return temp !== undefined && Number.isFinite(temp) ? `${Math.round(temp)}°` : '--';
}

export function generateHourlyData(weatherData: WeatherData | null): Array<{ x: number; y: number }> {
  if (!weatherData?.hourly?.time?.length) return [];

  const currentHour = weatherData.current.time.slice(0, 13);
  let startIndex = weatherData.hourly.time.findIndex((time) => time.slice(0, 13) >= currentHour);
  if (startIndex < 0) startIndex = 0;

  return weatherData.hourly.time.slice(startIndex, startIndex + 24).flatMap((_time, index) => {
    const temp = weatherData.hourly.temperature_2m[startIndex + index];
    if (!Number.isFinite(temp)) return [];

    return {
      x: index,
      y: temp,
    };
  });
}

export function isNightNow(weatherData: WeatherData | null): boolean {
  const currentTime = weatherData?.current.time;
  const today = currentTime?.slice(0, 10);
  const dayIndex = today ? weatherData?.daily.time.indexOf(today) ?? -1 : -1;

  if (!weatherData || !currentTime || dayIndex < 0) {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 20;
  }

  const sunrise = weatherData.daily.sunrise[dayIndex];
  const sunset = weatherData.daily.sunset[dayIndex];
  if (!sunrise || !sunset) {
    const hour = new Date(currentTime).getHours();
    return hour < 6 || hour >= 20;
  }

  return currentTime < sunrise || currentTime >= sunset;
}

export function generateDailyForecast(weatherData: WeatherData | null): DailyForecast[] {
  if (!weatherData?.daily) return [];

  return weatherData.daily.time.slice(1, 3).map((dateString, index) => {
    const sourceIndex = index + 1;
    const date = new Date(`${dateString}T12:00:00`);
    const label = index === 0
      ? 'Tomorrow'
      : new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);

    return {
      date: dateString,
      label,
      high: Math.round(weatherData.daily.temperature_2m_max[sourceIndex]),
      low: Math.round(weatherData.daily.temperature_2m_min[sourceIndex]),
      weatherCode: weatherData.daily.weather_code[sourceIndex],
    };
  });
}
