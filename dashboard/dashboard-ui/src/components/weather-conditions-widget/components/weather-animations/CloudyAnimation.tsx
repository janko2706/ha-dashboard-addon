import styles from './styles.module.css';

export function CloudyAnimation() {
    return (
        <div className={styles.cloudyAnimation}>
            <div className={styles.cloudLayer}>
                <img
                    src="/images/clouds/cloud_1.png"
                    alt=""
                    className={`${styles.cloudImage} ${styles.cloudStatic}`}
                    style={{ left: '0%' }}
                />
            </div>
            <div className={styles.cloudLayer}>
                <img
                    src="/images/clouds/cloud_2.png"
                    alt=""
                    className={`${styles.cloudImage} ${styles.cloudStatic}`}
                    style={{ left: '75%' }}
                />
            </div>

        </div>
    );
}
