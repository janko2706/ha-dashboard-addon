export interface WeatherData {
    current: {
        time: string;
        temperature_2m: number;
        weather_code: number;
    };
    hourly: {
        time: string[];
        temperature_2m: number[];
    };
    daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
        sunrise: string[];
        sunset: string[];
    };
}
