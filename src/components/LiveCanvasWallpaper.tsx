import React, { useEffect, useRef } from 'react';

interface LiveCanvasWallpaperProps {
  preset: string; // 'particles' | 'particle-mesh' | 'cyber-grid' | 'ocean-flow' | 'speed-telemetry' | 'constellation' | 'matrix' | 'anime-sakura' | 'mechanical-gears'
  playState?: 'playing' | 'paused';
  speed?: number; // default 1.0
  themeColor?: string; // e.g. '#FF3B30'
}

export const LiveCanvasWallpaper: React.FC<LiveCanvasWallpaperProps> = ({
  preset = 'particles',
  playState = 'playing',
  speed = 1.0,
  themeColor = '#FF3B30',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track mouse for interactive particle / node physics
    const mouse = { x: width * 0.5, y: height * 0.5, active: false, radius: 200 };
    const shockwaves: Array<{ x: number; y: number; r: number; maxR: number; alpha: number }> = [];

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };
    const handleClick = (e: MouseEvent) => {
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        r: 5,
        maxR: 160,
        alpha: 0.8,
      });
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('click', handleClick);

    let tick = 0;
    const isPaused = playState === 'paused';

    // 1. Slow-Moving Industrial Interactive Particles Setup
    const isParticlesPreset = preset === 'particles' || preset === 'particle-mesh';
    const particleCount = Math.min(85, Math.max(45, Math.floor((width * height) / 16000)));
    
    // Slow, measured speed for industrial terminal feel
    const baseSpeed = isParticlesPreset ? 0.45 : 0.8;
    
    const particles = Array.from({ length: particleCount }, (_, idx) => ({
      id: idx,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * baseSpeed * speed,
      vy: (Math.random() - 0.5) * baseSpeed * speed,
      baseRadius: Math.random() * 2 + 1.4,
      radius: Math.random() * 2 + 1.4,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.03 + 0.015,
      isHub: idx % 7 === 0, // Major telemetry hub node
      label: `N-0${(idx % 12) + 1}`,
    }));

    // 2. Starfield & Meteor Setup
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * width,
      size: Math.random() * 2.2 + 0.6,
      twinkleSpeed: Math.random() * 0.05 + 0.02,
    }));
    const meteors: Array<{ x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number }> = [];

    // 3. Speed Telemetry Streaks
    const streaks = Array.from({ length: 55 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random() * 180 + 60,
      v: (Math.random() * 6 + 3) * speed,
      alpha: Math.random() * 0.8 + 0.3,
    }));

    // 4. Matrix Characters
    const cols = Math.floor(width / 22);
    const ypos = Array.from({ length: cols }, () => Math.random() * height);

    // 5. Sakura Petals Setup (Anime Theme)
    const petals = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 7 + 6,
      vx: (Math.random() * 1.5 + 0.5) * speed,
      vy: (Math.random() * 1.2 + 0.8) * speed,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04 * speed,
      flip: Math.random() * Math.PI,
      flipSpeed: Math.random() * 0.03 * speed,
    }));

    // 6. Ocean Bubbles Setup
    const bubbles = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 4 + 2,
      vy: (Math.random() * 1.5 + 0.6) * speed,
      wobble: Math.random() * Math.PI * 2,
    }));

    // 7. Frosted Arctic Bokeh Orbs & Crystalline Motes Setup
    const frostOrbs = Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 130 + 70,
      vx: (Math.random() - 0.5) * 0.42 * speed,
      vy: (Math.random() - 0.5) * 0.36 * speed,
      hue: i % 3 === 0 ? '56, 189, 248' : i % 3 === 1 ? '129, 140, 248' : '255, 255, 255',
      alpha: i % 3 === 2 ? 0.38 : 0.24,
      phase: Math.random() * Math.PI * 2,
    }));

    const frostMotes = Array.from({ length: 48 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.2 + 0.8,
      vy: (Math.random() * 0.4 + 0.15) * speed,
      vx: (Math.random() - 0.5) * 0.3 * speed,
      alpha: Math.random() * 0.5 + 0.25,
    }));

    // Animation Loop
    const render = () => {
      if (!ctx) return;
      if (!isPaused) {
        tick += speed;
      }

      ctx.clearRect(0, 0, width, height);

      // ==============================================================
      // 1. PARTICLES PRESET (INDUSTRIAL TERMINAL FLOATING LINKED NODES)
      // ==============================================================
      if (preset === 'particles' || preset === 'particle-mesh') {
        const linkDistance = Math.min(160, Math.max(120, width * 0.1));
        const accent = themeColor || '#FF3B30';

        // Subtle Industrial Engineering Terminal Background Grid
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 59, 48, 0.04)';
        ctx.lineWidth = 0.6;
        const gridStep = 64;
        for (let gx = 0; gx < width; gx += gridStep) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, height);
          ctx.stroke();
        }
        for (let gy = 0; gy < height; gy += gridStep) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(width, gy);
          ctx.stroke();
        }
        ctx.restore();

        // Render Shockwave radar pulses on click
        for (let s = shockwaves.length - 1; s >= 0; s--) {
          const sw = shockwaves[s];
          if (!isPaused) {
            sw.r += 3.5 * speed;
            sw.alpha *= 0.94;
          }
          if (sw.alpha <= 0.02 || sw.r >= sw.maxR) {
            shockwaves.splice(s, 1);
            continue;
          }
          ctx.save();
          ctx.strokeStyle = `rgba(255, 59, 48, ${sw.alpha * 0.7})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Draw Links between neighboring slow-moving nodes
        ctx.lineWidth = 0.85;
        for (let i = 0; i < particles.length; i++) {
          const pi = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const pj = particles[j];
            const dx = pi.x - pj.x;
            const dy = pi.y - pj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < linkDistance) {
              const proximityAlpha = (1 - dist / linkDistance);
              const lineAlpha = proximityAlpha * 0.45;

              // Color based on whether connection involves a hub node
              if (pi.isHub || pj.isHub) {
                ctx.strokeStyle = `rgba(255, 59, 48, ${lineAlpha * 1.2})`;
              } else {
                ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha * 0.8})`;
              }

              ctx.beginPath();
              ctx.moveTo(pi.x, pi.y);
              ctx.lineTo(pj.x, pj.y);
              ctx.stroke();

              // Tiny floating laser packet traveling along links occasionally
              if ((i + j + Math.floor(tick * 0.04)) % 29 === 0) {
                const packetT = ((tick * 0.015 + i) % 1);
                const px = pi.x + (pj.x - pi.x) * packetT;
                const py = pi.y + (pj.y - pi.y) * packetT;
                ctx.fillStyle = '#FF3B30';
                ctx.fillRect(px - 1, py - 1, 2, 2);
              }
            }
          }

          // Interactive Links from Cursor / Mouse to nearby nodes
          if (mouse.active) {
            const mdx = mouse.x - pi.x;
            const mdy = mouse.y - pi.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

            if (mdist < mouse.radius) {
              const mouseLinkAlpha = (1 - mdist / mouse.radius) * 0.65;
              ctx.strokeStyle = `rgba(255, 59, 48, ${mouseLinkAlpha})`;
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(pi.x, pi.y);
              ctx.stroke();

              // Subtle gravitational drift towards cursor
              if (!isPaused) {
                const pull = (1 - mdist / mouse.radius) * 0.35;
                pi.x += (mdx / mdist) * pull;
                pi.y += (mdy / mdist) * pull;
              }
            }
          }
        }

        // Draw Interactive Cursor Target Node
        if (mouse.active) {
          ctx.save();
          ctx.strokeStyle = '#FF3B30';
          ctx.fillStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.shadowColor = '#FF3B30';
          ctx.shadowBlur = 12;

          // Target reticle
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Reticle Crosshairs
          ctx.beginPath();
          ctx.moveTo(mouse.x - 12, mouse.y); ctx.lineTo(mouse.x - 7, mouse.y);
          ctx.moveTo(mouse.x + 7, mouse.y); ctx.lineTo(mouse.x + 12, mouse.y);
          ctx.moveTo(mouse.x, mouse.y - 12); ctx.lineTo(mouse.x, mouse.y - 7);
          ctx.moveTo(mouse.x, mouse.y + 7); ctx.lineTo(mouse.x, mouse.y + 12);
          ctx.stroke();

          ctx.restore();
        }

        // Render Floating Nodes
        particles.forEach((p) => {
          if (!isPaused) {
            p.x += p.vx;
            p.y += p.vy;
            p.pulse += p.pulseSpeed;

            // Smooth boundary wrap / bounce
            if (p.x < -20) p.x = width + 20;
            if (p.x > width + 20) p.x = -20;
            if (p.y < -20) p.y = height + 20;
            if (p.y > height + 20) p.y = -20;
          }

          const pulseScale = (Math.sin(p.pulse) + 1) * 0.5;

          ctx.save();
          if (p.isHub) {
            // Major Industrial Telemetry Hub
            ctx.fillStyle = accent;
            ctx.shadowColor = accent;
            ctx.shadowBlur = 12;

            // Core
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.baseRadius * 1.6, 0, Math.PI * 2);
            ctx.fill();

            // Concentric Telemetry Target Ring
            const ringR = p.baseRadius * 2.8 + pulseScale * 3.5;
            ctx.strokeStyle = `rgba(255, 59, 48, ${0.35 + pulseScale * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
            ctx.stroke();

            // Small technical label next to hub node
            ctx.font = '8px JetBrains Mono, monospace';
            ctx.fillStyle = 'rgba(228, 228, 231, 0.45)';
            ctx.fillText(p.label, p.x + ringR + 3, p.y + 3);
          } else {
            // Standard floating node
            ctx.fillStyle = `rgba(228, 228, 231, ${0.55 + pulseScale * 0.35})`;
            ctx.shadowColor = accent;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.baseRadius + pulseScale * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });

      // ==========================================
      // 2. CYBER GRID (SYNTHWAVE 3D HORIZON)
      // ==========================================
      } else if (preset === 'cyber-grid') {
        const horizon = height * 0.52;

        // Radiant Sun on Horizon
        const sunRadius = Math.min(width, height) * 0.16;
        const sunGrad = ctx.createLinearGradient(0, horizon - sunRadius * 1.2, 0, horizon);
        sunGrad.addColorStop(0, '#f43f5e');
        sunGrad.addColorStop(0.5, '#fb923c');
        sunGrad.addColorStop(1, '#fde047');

        ctx.save();
        ctx.beginPath();
        ctx.arc(width * 0.5, horizon, sunRadius, Math.PI, 0, false);
        ctx.fillStyle = sunGrad;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 40;
        ctx.fill();

        // Horizontal slices through sun
        ctx.fillStyle = '#111113';
        for (let s = 0; s < 6; s++) {
          const sliceY = horizon - (s * sunRadius * 0.14) - 4;
          const sliceH = (s + 1) * 2.2;
          ctx.fillRect(width * 0.5 - sunRadius, sliceY, sunRadius * 2, sliceH);
        }
        ctx.restore();

        // Neon Mountain Silhouettes
        ctx.save();
        ctx.fillStyle = 'rgba(28, 15, 45, 0.95)';
        ctx.strokeStyle = 'rgba(217, 70, 239, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        const mtnPoints = [
          [0, 0], [0.12, -45], [0.22, -18], [0.35, -80], [0.46, -20],
          [0.55, -65], [0.68, -25], [0.78, -90], [0.88, -30], [1.0, 0]
        ];
        mtnPoints.forEach(([px, py]) => {
          ctx.lineTo(width * px, horizon + py);
        });
        ctx.lineTo(width, horizon);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Ambient Horizon Glow
        const grad = ctx.createLinearGradient(0, horizon - 160, 0, horizon + 200);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
        grad.addColorStop(0.4, 'rgba(217, 70, 239, 0.35)');
        grad.addColorStop(0.8, 'rgba(59, 130, 246, 0.25)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizon - 160, width, 360);

        // 3D Perspective horizontal moving grid lines
        ctx.lineWidth = 1.4;
        const gridStep = 45;
        const offset = (tick * 1.5) % gridStep;

        for (let y = horizon + 3; y <= height; y += (y - horizon + 12) * 0.16) {
          const movingY = y + offset * ((y - horizon) / height);
          if (movingY > height) continue;
          const lineAlpha = Math.min(0.85, (movingY - horizon) / (height - horizon) * 0.9 + 0.1);
          ctx.strokeStyle = `rgba(192, 132, 252, ${lineAlpha})`;
          ctx.beginPath();
          ctx.moveTo(0, movingY);
          ctx.lineTo(width, movingY);
          ctx.stroke();
        }

        // Perspective vertical radiating lines
        const vanishingX = width * 0.5;
        const lineCount = 32;
        for (let i = -lineCount; i <= lineCount; i++) {
          const bottomX = vanishingX + (i * width * 1.8) / lineCount;
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
          ctx.beginPath();
          ctx.moveTo(vanishingX, horizon);
          ctx.lineTo(bottomX, height);
          ctx.stroke();
        }

        // Glowing horizon dividing laser
        ctx.save();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        ctx.lineTo(width, horizon);
        ctx.stroke();
        ctx.restore();

      // ==========================================
      // 3. OCEAN FLOW (FLUID AQUATIC WAVES & CAUSTICS)
      // ==========================================
      } else if (preset === 'ocean-flow') {
        // Deep background light rays / caustics
        ctx.save();
        const numRays = 5;
        for (let r = 0; r < numRays; r++) {
          const rayAngle = (r - 2) * 0.12 + Math.sin(tick * 0.01 + r) * 0.05;
          const rayX = width * (0.2 + r * 0.15);
          const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + Math.tan(rayAngle) * height, height);
          rayGrad.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
          rayGrad.addColorStop(0.6, 'rgba(14, 116, 144, 0.08)');
          rayGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(rayX - 30, 0);
          ctx.lineTo(rayX + 30, 0);
          ctx.lineTo(rayX + Math.tan(rayAngle) * height + 120, height);
          ctx.lineTo(rayX + Math.tan(rayAngle) * height - 60, height);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // 4 Multi-frequency undulating fluid waves
        const waveCount = 4;
        const waveColors = [
          ['rgba(6, 182, 212, 0.4)', 'rgba(8, 145, 178, 0.25)'],
          ['rgba(20, 184, 166, 0.45)', 'rgba(13, 148, 136, 0.3)'],
          ['rgba(14, 165, 233, 0.5)', 'rgba(3, 105, 161, 0.35)'],
          ['rgba(2, 132, 199, 0.65)', 'rgba(12, 74, 110, 0.5)'],
        ];

        for (let i = 0; i < waveCount; i++) {
          ctx.beginPath();
          ctx.moveTo(0, height);

          const freq = 0.0022 + i * 0.0012;
          const amp = 42 + i * 18;
          const phase = tick * (0.025 + i * 0.012);
          const baseHeight = height * (0.55 + i * 0.11);

          for (let x = 0; x <= width; x += 12) {
            const y = baseHeight + Math.sin(x * freq + phase) * amp + Math.cos((x + tick * 8) * 0.0016) * 16;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(width, height);
          ctx.closePath();

          const waveGrad = ctx.createLinearGradient(0, baseHeight - amp, 0, height);
          waveGrad.addColorStop(0, waveColors[i][0]);
          waveGrad.addColorStop(1, waveColors[i][1]);
          ctx.fillStyle = waveGrad;
          ctx.fill();

          // Wave crest highlight shimmer
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.45 + i * 0.1})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        // Floating rising bubbles with wobble
        bubbles.forEach((b) => {
          if (!isPaused) {
            b.y -= b.vy;
            b.wobble += 0.04;
            if (b.y < -20) {
              b.y = height + 20;
              b.x = Math.random() * width;
            }
          }
          const wobbleX = b.x + Math.sin(b.wobble) * 6;
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(wobbleX, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Bubble light reflection
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(wobbleX - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

      // ==========================================
      // 4. ANIME SAKURA (JAPANESE SAKURA BLOSSOMS)
      // ==========================================
      } else if (preset === 'anime-sakura') {
        // Ambient soft pink bokeh background
        const numBokeh = 6;
        for (let b = 0; b < numBokeh; b++) {
          const bx = width * ((b * 0.18 + tick * 0.002) % 1.0);
          const by = height * (0.2 + (b % 3) * 0.25);
          const bgRad = 90 + (b % 4) * 35;
          const bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, bgRad);
          bGrad.addColorStop(0, 'rgba(244, 114, 182, 0.18)');
          bGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(bx, by, bgRad, 0, Math.PI * 2);
          ctx.fill();
        }

        // Falling 3D Tumbling Sakura Petals
        petals.forEach((p) => {
          if (!isPaused) {
            p.x += p.vx + Math.sin(tick * 0.02 + p.y * 0.01) * 0.8;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.flip += p.flipSpeed;

            if (p.y > height + 25) {
              p.y = -25;
              p.x = Math.random() * width;
            }
            if (p.x > width + 25) {
              p.x = -25;
            }
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.scale(Math.cos(p.flip), 1); // 3D tumbling flip

          // Petal shape
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-p.size * 0.6, -p.size * 0.8, -p.size * 0.8, -p.size * 1.6, 0, -p.size * 2);
          ctx.bezierCurveTo(p.size * 0.8, -p.size * 1.6, p.size * 0.6, -p.size * 0.8, 0, 0);

          const petalGrad = ctx.createLinearGradient(0, 0, 0, -p.size * 2);
          petalGrad.addColorStop(0, 'rgba(251, 113, 133, 0.85)');
          petalGrad.addColorStop(0.5, 'rgba(244, 114, 182, 0.75)');
          petalGrad.addColorStop(1, 'rgba(253, 242, 248, 0.9)');

          ctx.fillStyle = petalGrad;
          ctx.shadowColor = 'rgba(244, 114, 182, 0.5)';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        });

      // ==========================================
      // 5. MECHANICAL GEARS (INDUSTRIAL BLUEPRINT)
      // ==========================================
      } else if (preset === 'mechanical-gears') {
        // Technical Blueprint Drafting Grid
        ctx.save();
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.15)';
        ctx.lineWidth = 0.8;
        const gridStep = 40;
        for (let gx = 0; gx < width; gx += gridStep) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, height);
          ctx.stroke();
        }
        for (let gy = 0; gy < height; gy += gridStep) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(width, gy);
          ctx.stroke();
        }

        // Draw Interlocking Precision Gears
        const drawGear = (x: number, y: number, radius: number, teeth: number, rot: number, color: string) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);

          // Gear Outer Teeth
          ctx.beginPath();
          const toothAngle = (Math.PI * 2) / teeth;
          const toothDepth = radius * 0.16;

          for (let t = 0; t < teeth; t++) {
            const a = t * toothAngle;
            const r1 = radius;
            const r2 = radius + toothDepth;

            const x1 = Math.cos(a) * r1;
            const y1 = Math.sin(a) * r1;
            const x2 = Math.cos(a + toothAngle * 0.25) * r2;
            const y2 = Math.sin(a + toothAngle * 0.25) * r2;
            const x3 = Math.cos(a + toothAngle * 0.75) * r2;
            const y3 = Math.sin(a + toothAngle * 0.75) * r2;
            const x4 = Math.cos(a + toothAngle) * r1;
            const y4 = Math.sin(a + toothAngle) * r1;

            if (t === 0) ctx.moveTo(x1, y1);
            else ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.lineTo(x4, y4);
          }
          ctx.closePath();

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(234, 88, 12, 0.08)';
          ctx.fill();
          ctx.stroke();

          // Inner Pitch Circle
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
          ctx.stroke();

          // Center Hub & Axle
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
          ctx.fillStyle = '#111113';
          ctx.fill();

          // Spokes
          for (let s = 0; s < 4; s++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const sa = (s * Math.PI) / 2;
            ctx.lineTo(Math.cos(sa) * radius * 0.65, Math.sin(sa) * radius * 0.65);
            ctx.stroke();
          }

          ctx.restore();
        };

        // Gear Train Set
        const rotBase = tick * 0.008;
        drawGear(width * 0.82, height * 0.35, 120, 24, rotBase, 'rgba(234, 88, 12, 0.75)');
        drawGear(width * 0.82 - 180, height * 0.35 + 80, 80, 16, -rotBase * 1.5, 'rgba(249, 115, 22, 0.7)');
        drawGear(width * 0.18, height * 0.75, 140, 28, -rotBase * 0.85, 'rgba(217, 119, 6, 0.7)');
        drawGear(width * 0.18 + 195, height * 0.75 - 75, 75, 15, rotBase * 1.6, 'rgba(234, 88, 12, 0.65)');

        // Crosshairs & CAD Dimensioning Marks
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.5)';
        ctx.lineWidth = 1;
        const cx = width * 0.5;
        const cy = height * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.moveTo(cx - 70, cy); ctx.lineTo(cx + 70, cy);
        ctx.moveTo(cx, cy - 70); ctx.lineTo(cx, cy + 70);
        ctx.stroke();

        ctx.restore();

      // ==========================================
      // 6. SPEED TELEMETRY (MOTORSPORT HUD)
      // ==========================================
      } else if (preset === 'speed-telemetry') {
        // High-velocity aerodynamic photon streaks
        ctx.lineWidth = 2.2;
        streaks.forEach((st) => {
          if (!isPaused) {
            st.x += st.v * 2.2;
            if (st.x > width + st.len) {
              st.x = -st.len - Math.random() * 200;
              st.y = Math.random() * height;
            }
          }

          const streakGrad = ctx.createLinearGradient(st.x - st.len, st.y, st.x, st.y);
          streakGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
          streakGrad.addColorStop(0.7, `rgba(248, 113, 113, ${st.alpha * 0.7})`);
          streakGrad.addColorStop(1, `rgba(255, 255, 255, ${st.alpha})`);

          ctx.strokeStyle = streakGrad;
          ctx.beginPath();
          ctx.moveTo(st.x - st.len, st.y);
          ctx.lineTo(st.x, st.y);
          ctx.stroke();

          // Flare head
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.fillRect(st.x - 2, st.y - 1.5, 3, 3);
        });

        // Pulsing Tachometer Dial in Bottom Right
        ctx.save();
        const tachoX = width - 130;
        const tachoY = height - 120;
        const tachoR = 85;

        // Dial Arc
        ctx.beginPath();
        ctx.arc(tachoX, tachoY, tachoR, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 8;
        ctx.stroke();

        // Active Rev Pulse Arc
        const revPct = 0.65 + Math.sin(tick * 0.05) * 0.25;
        ctx.beginPath();
        ctx.arc(tachoX, tachoY, tachoR, Math.PI * 0.75, Math.PI * 0.75 + revPct * Math.PI * 1.5);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
        ctx.stroke();

        // Speed text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(210 + revPct * 75)}`, tachoX, tachoY + 6);
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('KM/H · TELEMETRY', tachoX, tachoY + 24);
        ctx.restore();

      // ==========================================
      // 7. CONSTELLATION (SPACE & NEBULA)
      // ==========================================
      } else if (preset === 'constellation') {
        // Deep space stars
        stars.forEach((star) => {
          if (!isPaused) {
            star.y -= 0.4 * speed;
            if (star.y < 0) {
              star.y = height;
              star.x = Math.random() * width;
            }
          }

          const pulse = (Math.sin(tick * star.twinkleSpeed + star.x) + 1) * 0.5;
          ctx.fillStyle = `rgba(224, 231, 255, ${0.4 + pulse * 0.6})`;
          ctx.shadowColor = '#818cf8';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        });

        // Spawn occasional dynamic shooting star
        if (!isPaused && Math.random() < 0.015 && meteors.length < 3) {
          meteors.push({
            x: Math.random() * width * 0.8,
            y: Math.random() * height * 0.3,
            vx: (Math.random() * 8 + 8) * speed,
            vy: (Math.random() * 5 + 4) * speed,
            len: Math.random() * 120 + 80,
            life: 0,
            maxLife: 45,
          });
        }

        // Render shooting stars
        for (let m = meteors.length - 1; m >= 0; m--) {
          const met = meteors[m];
          if (!isPaused) {
            met.x += met.vx;
            met.y += met.vy;
            met.life++;
          }

          const mAlpha = 1 - met.life / met.maxLife;
          if (mAlpha <= 0) {
            meteors.splice(m, 1);
            continue;
          }

          const mGrad = ctx.createLinearGradient(met.x - met.vx * 6, met.y - met.vy * 6, met.x, met.y);
          mGrad.addColorStop(0, 'rgba(129, 140, 248, 0)');
          mGrad.addColorStop(1, `rgba(255, 255, 255, ${mAlpha})`);

          ctx.strokeStyle = mGrad;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(met.x - met.vx * 6, met.y - met.vy * 6);
          ctx.lineTo(met.x, met.y);
          ctx.stroke();
        }

      // ==========================================
      // 8. MATRIX (DIGITAL FALLING CODE)
      // ==========================================
      } else if (preset === 'matrix') {
        ctx.font = '13px JetBrains Mono, monospace';

        ypos.forEach((y, index) => {
          const char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 64));
          const x = index * 22;

          // Glowing leader head
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 12;
          ctx.fillText(char, x, y);

          // Emerald trail characters
          ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
          ctx.shadowBlur = 0;
          for (let trail = 1; trail < 8; trail++) {
            const trailY = y - trail * 14;
            if (trailY > 0) {
              const trailChar = String.fromCharCode(0x30a0 + Math.floor((trail * 13 + index) % 64));
              ctx.fillStyle = `rgba(16, 185, 129, ${0.75 - trail * 0.09})`;
              ctx.fillText(trailChar, x, trailY);
            }
          }

          if (!isPaused) {
            ypos[index] = y > height + Math.random() * 200 ? 0 : y + 3.5 * speed;
          }
        });

      // ==========================================
      // 9. FROST BOKEH (TRANSLUCENT ARCTIC GLASS)
      // ==========================================
      } else if (preset === 'frost-bokeh') {
        frostOrbs.forEach((orb) => {
          if (!isPaused) {
            orb.x += orb.vx;
            orb.y += orb.vy;
            if (orb.x < -orb.r) orb.x = width + orb.r;
            if (orb.x > width + orb.r) orb.x = -orb.r;
            if (orb.y < -orb.r) orb.y = height + orb.r;
            if (orb.y > height + orb.r) orb.y = -orb.r;
          }

          const shimmer = 0.85 + Math.sin(tick * 0.015 + orb.phase) * 0.15;
          const grad = ctx.createRadialGradient(orb.x, orb.y, orb.r * 0.08, orb.x, orb.y, orb.r);
          grad.addColorStop(0, `rgba(${orb.hue}, ${orb.alpha * shimmer})`);
          grad.addColorStop(0.55, `rgba(${orb.hue}, ${orb.alpha * 0.45 * shimmer})`);
          grad.addColorStop(1, `rgba(${orb.hue}, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
          ctx.fill();
        });

        frostMotes.forEach((m) => {
          if (!isPaused) {
            m.x += m.vx;
            m.y += m.vy;
            if (m.y > height + 10) {
              m.y = -10;
              m.x = Math.random() * width;
            }
            if (m.x < -10) m.x = width + 10;
            if (m.x > width + 10) m.x = -10;
          }

          ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('click', handleClick);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [preset, playState, speed, themeColor]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ display: 'block' }}
    />
  );
};
