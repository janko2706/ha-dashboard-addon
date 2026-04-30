import React, { useEffect, useRef } from 'react';
import { VB_X, VB_Y, VB_W, VB_H } from '../constants';

/**
 * Loads the floor plan SVG and keeps ONLY the room-label text elements visible.
 * All original wall paths and border rects are hidden here — walls are redrawn
 * cleanly by SVGOverlay so we never get double-walls or colour inconsistencies.
 */
export const SVGBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/floorplan.svg')
      .then(r => r.text())
      .then(text => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = text;
        const svg = containerRef.current.querySelector('svg') as SVGSVGElement | null;
        if (!svg) return;

        svg.setAttribute('viewBox', `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.cssText = 'width:100%;height:100%;display:block;';

        // ── Background canvas → dark ────────────────────────────────────
        svg.querySelectorAll('rect').forEach(el => {
          if (el.getAttribute('width') === '562' && el.getAttribute('height') === '364')
            el.setAttribute('fill', '#0d0d0d');
        });

        // ── Hide ALL original wall elements ─────────────────────────────
        // Mask-based thick walls
        svg.querySelectorAll('path[mask]').forEach(el =>
          el.setAttribute('fill', 'none'),
        );
        // Stroke-based border rects
        svg.querySelectorAll('rect[stroke]').forEach(el => {
          if (!el.closest('mask')) {
            el.setAttribute('stroke', 'none');
            el.setAttribute('fill', 'none');
          }
        });
        // White "erase" paths used as door openings — make them transparent
        svg.querySelectorAll<SVGPathElement>('path[fill="white"]').forEach(el => {
          if (!el.closest('mask')) el.setAttribute('fill', 'none');
        });

        // ── Room labels → muted grey ────────────────────────────────────
        svg.querySelectorAll('[id$="_2"]').forEach(el =>
          el.setAttribute('fill', '#4a4a4a'),
        );

        const toiletteLabel = svg.querySelector('#Toilette_2');
        toiletteLabel?.setAttribute('fill', 'none');

        const wcLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        wcLabel.setAttribute('x', '288');
        wcLabel.setAttribute('y', '162');
        wcLabel.setAttribute('text-anchor', 'middle');
        wcLabel.setAttribute('font-size', '4');
        wcLabel.setAttribute('font-family', 'DejaVu Sans, sans-serif');
        wcLabel.setAttribute('font-weight', '700');
        wcLabel.setAttribute('fill', '#4a4a4a');
        wcLabel.textContent = 'WC';
        svg.appendChild(wcLabel);
      });
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
};
