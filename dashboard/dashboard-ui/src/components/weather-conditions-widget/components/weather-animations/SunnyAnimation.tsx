import styles from './styles.module.css';

interface SunnyAnimationProps {
    isNight?: boolean;
}

export function SunnyAnimation({ isNight = false }: SunnyAnimationProps) {
    return (
        <div className={styles.sunnyAnimation}>
            {isNight ? (
                <>
                    <div className={styles.subtleMoonGlow} />
                    <div className={styles.moonDisc} />
                    <div className={styles.moonHalo} />
                </>
            ) : (
                <>
                    <div className={styles.subtleSunGlow} />
                    <div className={styles.gentleLensFlare} />
                </>
            )}
        </div>
    );
}
