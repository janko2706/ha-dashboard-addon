import { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

interface LightningBolt {
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    segments: { x: number; y: number }[];
    opacity: number;
    width: number;
    animationTime: number;
    duration: number;
    isVisible: boolean;
}

export function ThunderAnimation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const lightningBoltsRef = useRef<LightningBolt[]>([]);
    const [showFlash, setShowFlash] = useState(false);
    const nextLightningRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        function resizeCanvas() {
            if (!canvas) return;
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        function generateLightningPath(startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] {
            const segments: { x: number; y: number }[] = [{ x: startX, y: startY }];
            const numSegments = 8 + Math.floor(Math.random() * 12);

            for (let i = 1; i < numSegments; i++) {
                const progress = i / numSegments;
                const baseX = startX + (endX - startX) * progress;
                const baseY = startY + (endY - startY) * progress;

                const jaggerX = (Math.random() - 0.5) * 40;
                const jaggerY = (Math.random() - 0.5) * 20;

                segments.push({
                    x: baseX + jaggerX,
                    y: baseY + jaggerY
                });
            }

            segments.push({ x: endX, y: endY });
            return segments;
        }

        function createLightningBolt(): LightningBolt {
            const startX = 50 + Math.random() * ((canvas?.width ?? 0) - 100);
            const startY = -20;
            const endX = startX + (Math.random() - 0.5) * 100;
            const endY = (canvas?.height ?? 0) + 20;

            return {
                id: Date.now() + Math.random(),
                startX,
                startY,
                endX,
                endY,
                segments: generateLightningPath(startX, startY, endX, endY),
                opacity: 1,
                width: 2 + Math.random() * 3,
                animationTime: 0,
                duration: 150 + Math.random() * 100,
                isVisible: true
            };
        }

        function updateLightning(bolt: LightningBolt, deltaTime: number): boolean {
            bolt.animationTime += deltaTime;

            if (bolt.animationTime > bolt.duration) {
                return false;
            }

            if (Math.random() < 0.3) {
                bolt.isVisible = !bolt.isVisible;
            }

            const progress = bolt.animationTime / bolt.duration;
            if (progress > 0.7) {
                bolt.opacity = 1 - ((progress - 0.7) / 0.3);
            }

            return true;
        }

        function drawLightning(bolt: LightningBolt) {
            if (!bolt.isVisible) return;
            if (!ctx) return;

            ctx.save();
            ctx.globalAlpha = bolt.opacity;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = bolt.width;
            ctx.shadowColor = '#87CEEB';
            ctx.shadowBlur = 10;

            ctx.beginPath();
            ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);

            for (let i = 1; i < bolt.segments.length; i++) {
                ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }

            ctx.stroke();

            ctx.strokeStyle = '#B0E0E6';
            ctx.lineWidth = bolt.width * 2;
            ctx.shadowBlur = 20;
            ctx.globalAlpha = bolt.opacity * 0.5;
            ctx.stroke();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = bolt.width * 0.5;
            ctx.shadowBlur = 5;
            ctx.globalAlpha = bolt.opacity;
            ctx.stroke();

            ctx.restore();
        }

        function triggerScreenFlash() {
            setShowFlash(true);
            setTimeout(() => setShowFlash(false), 100);
        }

        let lastTime = performance.now();
        nextLightningRef.current = lastTime + 3000 + Math.random() * 5000;

        function animate(currentTime: number) {
            if (!ctx) return;
            if (!canvas) return;

            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (currentTime > nextLightningRef.current) {
                const newBolt = createLightningBolt();
                lightningBoltsRef.current.push(newBolt);
                triggerScreenFlash();

                nextLightningRef.current = currentTime + 2000 + Math.random() * 6000;
            }

            lightningBoltsRef.current = lightningBoltsRef.current.filter(bolt => {
                return updateLightning(bolt, deltaTime);
            });

            lightningBoltsRef.current.forEach(bolt => {
                drawLightning(bolt);
            });

            animationRef.current = requestAnimationFrame(animate);
        }

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current != null) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <div className={styles.thunderAnimation}>
            {showFlash && (
                <div
                    className={styles.lightningFlash}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        zIndex: 25,
                        pointerEvents: 'none'
                    }}
                />
            )}

            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 30,
                    pointerEvents: 'none'
                }}
            />
        </div>
    );
}
