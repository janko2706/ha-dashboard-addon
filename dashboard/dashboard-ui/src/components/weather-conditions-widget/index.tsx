import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { WeatherAnimations } from './components/weather-animations/WeatherAnimations';
import {
    formatTemp,
    generateDailyForecast,
    generateHourlyData,
    getConditionText,
    getWeatherBackgroundClass,
    getWeatherIcon,
    isNightNow,
} from './utils/weatherUtils';
import { WeatherData } from './types/weatherTypes';
import styles from './styles.module.css';

const ROHR_LAT = 48.07;
const ROHR_LON = 14.19;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;

const WEATHER_URL =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${ROHR_LAT}` +
    `&longitude=${ROHR_LON}` +
    '&current=temperature_2m,weather_code' +
    '&hourly=temperature_2m' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset' +
    '&timezone=Europe%2FVienna' +
    '&forecast_days=3';

export default function WeatherConditionsWidget() {
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchWeatherData = () => {
            fetch(WEATHER_URL)
                .then((response) => {
                    if (!response.ok) throw new Error(`Weather API ${response.status}`);
                    return response.json() as Promise<WeatherData>;
                })
                .then((data) => {
                    if (cancelled) return;
                    setWeatherData(data);
                    setError(null);
                })
                .catch((err: Error) => {
                    if (!cancelled) setError(err.message);
                });
        };

        fetchWeatherData();
        const interval = window.setInterval(fetchWeatherData, WEATHER_REFRESH_MS);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    const weatherCode = weatherData?.current.weather_code ?? null;
    const isNight = isNightNow(weatherData);
    const forecastDays = useMemo(() => generateDailyForecast(weatherData), [weatherData]);
    const hourlyData = useMemo(() => generateHourlyData(weatherData), [weatherData]);
    const chartOptions = useMemo<ApexOptions>(() => ({
        chart: {
            type: 'area',
            toolbar: { show: false },
            zoom: { enabled: false },
            background: 'transparent',
            sparkline: { enabled: false },
            fontFamily: 'inherit',
        },
        dataLabels: { enabled: false },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: ['var(--color)'],
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.3,
                opacityTo: 0,
                stops: [0, 100],
            },
        },
        colors: ['var(--color)'],
        markers: { size: 0 },
        xaxis: {
            categories: hourlyData.map((point) => {
                const currentHour = new Date().getHours();
                const hour = (currentHour + point.x) % 24;
                return hour === 0 ? '12AM' : hour <= 12 ? `${hour}AM` : `${hour - 12}PM`;
            }),
            labels: {
                style: { colors: 'var(--color)', fontSize: '10px' },
                rotate: 0,
                show: true,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tickAmount: 5,
        },
        yaxis: { show: false },
        grid: { show: false },
        tooltip: {
            theme: 'dark',
            custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                const temp = Math.round(hourlyData[dataPointIndex]?.y ?? 0);
                return `<div style="background:rgba(0,0,0,0.9);color:white;padding:8px 12px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.3)">${temp}°C</div>`;
            },
        },
    }), [hourlyData]);

    if (!weatherData || weatherCode == null) {
        return (
            <section className={`${styles.weatherWidget} ${styles.defaultBackground}`} aria-label="Weather forecast">
                <div className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Outside</p>
                        <h2>Rohr im Kremstal</h2>
                    </div>
                </div>
                <div className={styles.loadingText}>{error ?? 'Loading weather'}</div>
            </section>
        );
    }

    return (
        <section
            className={`${styles.weatherWidget} ${getWeatherBackgroundClass(weatherCode, styles, isNight)}`}
            aria-label="Weather forecast for Rohr im Kremstal"
        >
            <WeatherAnimations weatherCode={weatherCode} isNight={isNight} />

            <div className={styles.content}>
                <div className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Outside</p>
                        <h2>Rohr im Kremstal</h2>
                    </div>
                    <div className={styles.date}>
                        {new Intl.DateTimeFormat('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                        }).format(new Date())}
                    </div>
                </div>

                <div className={styles.currentWeather}>
                    <div className={styles.currentTemp}>
                        {formatTemp(weatherData.current.temperature_2m)}
                    </div>
                    <div className={styles.currentIcon}>{getWeatherIcon(weatherCode, isNight)}</div>
                    <div className={styles.currentCondition}>{getConditionText(weatherCode, isNight)}</div>
                </div>

                {hourlyData.length > 0 && (
                    <div className={styles.chartContainer} aria-hidden="true">
                        <Chart
                            options={chartOptions}
                            series={[{ name: 'temperature', data: hourlyData.map((point) => point.y) }]}
                            type="area"
                            height="100%"
                            width="100%"
                        />
                    </div>
                )}

                <div className={styles.forecast}>
                    <div className={styles.forecastTitle}>Next two days</div>
                    <div className={styles.forecastGrid}>
                        {forecastDays.map((day) => (
                            <div key={day.date} className={styles.forecastDay}>
                                <div className={styles.dayLabel}>{day.label}</div>
                                <div className={styles.forecastIcon}>{getWeatherIcon(day.weatherCode)}</div>
                                <div className={styles.forecastCondition}>{getConditionText(day.weatherCode)}</div>
                                <div className={styles.forecastTemp}>
                                    <span>{formatTemp(day.high)}</span>
                                    <span className={styles.lowTemp}>{formatTemp(day.low)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
