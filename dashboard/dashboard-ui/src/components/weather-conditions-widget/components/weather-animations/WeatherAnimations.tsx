import { CloudyAnimation } from "./CloudyAnimation";
import { SimpleRainAnimation } from "./SimpleRainAnimation";
import { SnowAnimation } from "./SnowAnimation";
import { SunnyAnimation } from "./SunnyAnimation";
import { ThunderAnimation } from "./ThunderAnimation";

interface WeatherAnimationsProps {
    weatherCode: number;
    isNight?: boolean;
    windSpeed?: number;
    precipitation?: number;
}

export function WeatherAnimations(props: WeatherAnimationsProps) {
    function getWeatherAnimation(code: number) {
        switch (code) {
            case 0:
                return <SunnyAnimation isNight={props.isNight} />;

            case 1:
                return (
                    <>
                        <SunnyAnimation isNight={props.isNight} />
                        <CloudyAnimation />
                    </>
                );

            case 2:
                return (
                    <>
                        <CloudyAnimation />
                        <SunnyAnimation isNight={props.isNight} />
                    </>
                );

            case 3:
            case 45:
            case 48:
                return <CloudyAnimation />;

            case 51:
            case 53:
            case 55:
            case 61:
            case 63:
            case 65:
                return (
                    <>
                        <CloudyAnimation />
                        <SimpleRainAnimation />
                    </>
                );

            case 56:
            case 57:
            case 66:
            case 67:
                return (
                    <>
                        <CloudyAnimation />
                        <SimpleRainAnimation />
                    </>
                );

            case 71:
            case 73:
            case 75:
            case 76:
            case 77:
                return (
                    <>
                        <CloudyAnimation />
                        <SnowAnimation />
                    </>
                );

            case 80:
            case 81:
            case 82:
                return (
                    <>
                        <CloudyAnimation />
                        <SimpleRainAnimation />
                        <SunnyAnimation isNight={props.isNight} />
                    </>
                );

            case 85:
            case 86:
                return (
                    <>
                        <CloudyAnimation />
                        <SnowAnimation />
                        <SunnyAnimation isNight={props.isNight} />
                    </>
                );

            case 95:
                return (
                    <>
                        <CloudyAnimation />
                        <ThunderAnimation />
                        <SimpleRainAnimation />
                    </>
                );

            case 96:
            case 99:
                return (
                    <>
                        <CloudyAnimation />
                        <ThunderAnimation />
                        <SimpleRainAnimation />
                        <SnowAnimation />
                    </>
                );

            default:
                return <CloudyAnimation />;
        }
    }

    return <>{getWeatherAnimation(props.weatherCode)}</>;
}
