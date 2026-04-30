import React, { useEffect, useRef } from 'react';
import styles from './styles.module.css';

interface FallingDroplet {
    x: number;
    y: number;
    size: number;
    opacity: number;
    imageType: 1 | 2;
    fallSpeed: number;
}

interface SplashParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    life: number;
    maxLife: number;
}

interface Splash {
    x: number;
    y: number;
    particles: SplashParticle[];
    animationTime: number;
}

export function SimpleRainAnimation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const dropletsRef = useRef<FallingDroplet[]>([]);
    const splashesRef = useRef<Splash[]>([]);
    const dropImagesRef = useRef<{ drop1: HTMLImageElement | null; drop2: HTMLImageElement | null }>({
        drop1: null,
        drop2: null
    });

    useEffect(() => {

        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }


        function resizeCanvas() {
            if (!canvas) {
                return;
            }

            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        async function loadImages() {
            const drop1 = new Image();
            const drop2 = new Image();

            return new Promise<void>((resolve) => {
                let imagesLoaded = 0;
                const onImageLoad = () => {
                    imagesLoaded++;
                    if (imagesLoaded === 2) {
                        dropImagesRef.current.drop1 = drop1;
                        dropImagesRef.current.drop2 = drop2;
                        resolve();
                    }
                };

                drop1.onload = onImageLoad;
                drop2.onload = onImageLoad;
                drop1.onerror = () => console.error('Failed to load drop_1.png');
                drop2.onerror = () => console.error('Failed to load drop_2.png');

                drop1.src = '/images/rain/drop_1.png';
                drop2.src = '/images/rain/drop_2.png';
            });
        };

        function createDroplet(): FallingDroplet {
            return {
                x: Math.random() * ((canvas?.width) ?? 0),
                y: -50 - Math.random() * 100,
                size: 0.5 + Math.random() * 0.5,
                opacity: 0.7 + Math.random() * 0.3,
                imageType: Math.random() > 0.5 ? 1 : 2,
                fallSpeed: 3 + Math.random() * 4
            };
        }

        function createSplash(x: number, y: number): Splash {
            const particles: SplashParticle[] = [];
            const numParticles = 3 + Math.floor(Math.random() * 3);

            for (let i = 0; i < numParticles; i++) {
                const angle = (-Math.PI * 2 / 3) + (Math.random() * Math.PI * 1 / 3);
                const speed = 0.5 + Math.random() * 1.5;
                const life = 200 + Math.random() * 150;

                particles.push({
                    x: x + (Math.random() - 0.5) * 2,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 1 + Math.random() * 0.8,
                    opacity: 0.6 + Math.random() * 0.2,
                    life: 0,
                    maxLife: life
                });
            }

            return {
                x,
                y,
                particles,
                animationTime: 0
            };
        };

        function updateDroplet(droplet: FallingDroplet, deltaTime: number): boolean {
            droplet.y += droplet.fallSpeed;

            if (droplet.y >= (canvas?.height ?? 0) - 10) {

                splashesRef.current.push(createSplash(droplet.x, (canvas?.height ?? 0) - 5));
                return false;
            }

            return true;
        };

        function updateSplash(splash: Splash, deltaTime: number): boolean {
            splash.animationTime += deltaTime;
            let hasLiveParticles = false;

            splash.particles.forEach(particle => {
                if (particle.life < particle.maxLife) {
                    particle.life += deltaTime;

                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    particle.vy += 0.15;
                    particle.vx *= 0.98;

                    const lifeProgress = particle.life / particle.maxLife;
                    particle.opacity = 0.9 * (1 - lifeProgress);

                    hasLiveParticles = true;
                }
            });

            return hasLiveParticles;
        };

        function drawDroplet(droplet: FallingDroplet) {
            const image = droplet.imageType === 1 ? dropImagesRef.current.drop1 : dropImagesRef.current.drop2;
            if (!image) return;
            if (!ctx) return;

            ctx.save();
            ctx.translate(droplet.x, droplet.y);
            ctx.globalAlpha = droplet.opacity;

            const drawSize = 18 * droplet.size;
            ctx.drawImage(
                image,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );

            ctx.restore();
        };

        function drawSplash(splash: Splash) {
            if (!ctx) return;
            ctx.save();

            splash.particles.forEach(particle => {
                if (particle.life < particle.maxLife) {
                    ctx.save();
                    ctx.globalAlpha = particle.opacity;

                    ctx.fillStyle = '#87CEEB';
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.globalAlpha = particle.opacity * 0.6;
                    ctx.fillStyle = '#B0E0E6';
                    ctx.beginPath();
                    ctx.arc(particle.x - particle.size * 0.3, particle.y - particle.size * 0.3, particle.size * 0.4, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            });

            ctx.restore();
        }; const startAnimation = async () => {
            await loadImages();

            dropletsRef.current = [];
            splashesRef.current = [];

            let lastTime = performance.now();
            let lastDropletTime = 0;
            const dropletInterval = 200;

            const animate = (currentTime: number) => {
                const deltaTime = currentTime - lastTime;
                lastTime = currentTime;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (currentTime - lastDropletTime > dropletInterval) {
                    dropletsRef.current.push(createDroplet());
                    lastDropletTime = currentTime;
                }

                dropletsRef.current = dropletsRef.current.filter(droplet => {
                    return updateDroplet(droplet, deltaTime);
                });

                splashesRef.current = splashesRef.current.filter(splash => {
                    return updateSplash(splash, deltaTime);
                });

                dropletsRef.current.forEach(droplet => {
                    drawDroplet(droplet);
                });

                splashesRef.current.forEach(splash => {
                    drawSplash(splash);
                });

                animationRef.current = requestAnimationFrame(animate);
            };

            animationRef.current = requestAnimationFrame(animate);
        };

        startAnimation();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current != null) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <div className={styles.rainAnimation}>
            <canvas
                ref={canvasRef}
                className={styles.raindropsCanvas}
            />
        </div>
    );
};
