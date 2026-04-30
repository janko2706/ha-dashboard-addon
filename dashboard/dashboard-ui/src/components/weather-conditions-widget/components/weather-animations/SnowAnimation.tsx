import React from 'react';
import styles from './styles.module.css';

function generateSnowParticles() {
    return [...Array(60)].map((_, i) => (
        <div
            key={i}
            className={styles.snowParticle}
            style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                transform: `scale(${0.5 + Math.random() * 0.8})`,
                top: `${-10 - Math.random() * 20}%`,
            }}
        />
    ));
}

export function SnowAnimation() {
    return (
        <div className={styles.snowAnimation}>
            {generateSnowParticles()}
        </div>
    );
}
