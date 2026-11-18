export interface BackgroundPreset {
  id: string;
  name: string;
  tagline?: string;
  category: 'industrial' | 'ocean' | 'automotive' | 'cyber' | 'corporate';
  description: string;
  thumbnailGradient: string;
  dataUrl: string; // Clean SVG data URL so it works 100% offline without external network request!
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'industrial-ndt',
    name: 'Industrial Inspection Facility',
    category: 'industrial',
    description: 'Piping inspection, pressure vessel gauges & industrial calibration bay',
    thumbnailGradient: 'from-amber-700 via-stone-800 to-slate-900',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e293b"/><stop offset="50%" stop-color="%230f172a"/><stop offset="100%" stop-color="%23020617"/></linearGradient><linearGradient id="pipe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23f59e0b" stop-opacity="0.25"/><stop offset="100%" stop-color="%23b45309" stop-opacity="0.05"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23g1)"/><g stroke="%2338bdf8" stroke-width="1" stroke-opacity="0.12"><path d="M0,200 Q480,260 960,200 T1920,200"/><path d="M0,450 Q480,520 960,450 T1920,450"/><path d="M0,700 Q480,780 960,700 T1920,700"/></g><g stroke="%23f59e0b" stroke-width="2" stroke-opacity="0.15" fill="none"><circle cx="400" cy="350" r="120"/><circle cx="400" cy="350" r="80"/><line x1="400" y1="230" x2="400" y2="470"/><line x1="280" y1="350" x2="520" y2="350"/><circle cx="1500" cy="650" r="160"/><circle cx="1500" cy="650" r="100"/><line x1="1500" y1="490" x2="1500" y2="810"/><line x1="1340" y1="650" x2="1660" y2="650"/></g><rect x="0" y="880" width="1920" height="200" fill="url(%23pipe)"/></svg>`,
  },
  {
    id: 'ocean-waves',
    name: 'Ocean Offshore Platform',
    category: 'ocean',
    description: 'Deep marine waters, aquatic flow & offshore energy inspection',
    thumbnailGradient: 'from-cyan-900 via-teal-900 to-slate-950',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="oceanG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23083344"/><stop offset="50%" stop-color="%23042f2e"/><stop offset="100%" stop-color="%23021b24"/></linearGradient><linearGradient id="waveG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="%2306b6d4" stop-opacity="0.25"/><stop offset="100%" stop-color="%2314b8a6" stop-opacity="0.1"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23oceanG)"/><path d="M0,600 C320,520 640,680 960,600 C1280,520 1600,680 1920,600 L1920,1080 L0,1080 Z" fill="url(%23waveG)"/><path d="M0,750 C400,680 800,820 1200,750 C1600,680 1800,790 1920,750 L1920,1080 L0,1080 Z" fill="%230891b2" fill-opacity="0.15"/><circle cx="960" cy="300" r="280" fill="%2306b6d4" fill-opacity="0.04"/></svg>`,
  },
  {
    id: 'car-motorsport',
    name: 'Motorsport & Automotive Performance',
    category: 'automotive',
    description: 'Dynamic racing circuit lines, tachometer sweep & speed telemetry',
    thumbnailGradient: 'from-red-950 via-zinc-950 to-neutral-900',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="carG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2309090b"/><stop offset="100%" stop-color="%2318181b"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23carG)"/><g stroke="%23ef4444" stroke-width="2" stroke-opacity="0.2" fill="none"><path d="M-100,900 L600,200 L1400,1000 L2100,100"/><circle cx="1400" cy="400" r="220" stroke-dasharray="10 15"/><circle cx="1400" cy="400" r="180"/></g><g stroke="%23f87171" stroke-width="4" stroke-opacity="0.15"><line x1="0" y1="1020" x2="1920" y2="1020"/><line x1="0" y1="1040" x2="1920" y2="1040"/></g></svg>`,
  },
  {
    id: 'anime-cyberpunk',
    name: 'Cyber Anime Neo-Tokyo',
    tagline: 'Sakura neon glow, synthwave grid & anime horizon skyline',
    category: 'cyber',
    description: 'Neon purple aesthetics, sakura glow & digital grid lines',
    thumbnailGradient: 'from-purple-950 via-fuchsia-950 to-slate-950',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="animeG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e1035"/><stop offset="50%" stop-color="%230e0720"/><stop offset="100%" stop-color="%2305020c"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23animeG)"/><circle cx="960" cy="400" r="260" fill="%23d946ef" fill-opacity="0.08"/><g stroke="%23c084fc" stroke-width="1.5" stroke-opacity="0.15" fill="none"><path d="M0,600 L1920,600"/><line x1="960" y1="600" x2="0" y2="1080"/><line x1="960" y1="600" x2="380" y2="1080"/><line x1="960" y1="600" x2="760" y2="1080"/><line x1="960" y1="600" x2="1160" y2="1080"/><line x1="960" y1="600" x2="1540" y2="1080"/><line x1="960" y1="600" x2="1920" y2="1080"/></g></svg>`,
  },
  {
    id: 'technical-blueprint',
    name: 'Mechanical Engineering Blueprint',
    category: 'industrial',
    description: 'Engineering drafting schematics, dimension callouts & valve geometry',
    thumbnailGradient: 'from-blue-950 via-slate-900 to-indigo-950',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="bpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%230f2b59"/><stop offset="100%" stop-color="%23081833"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bpG)"/><g stroke="%2360a5fa" stroke-width="1" stroke-opacity="0.18" fill="none"><rect x="100" y="100" width="1720" height="880"/><rect x="120" y="120" width="1680" height="840"/><circle cx="500" cy="400" r="140"/><circle cx="500" cy="400" r="100"/><rect x="420" y="320" width="160" height="160"/><line x1="500" y1="200" x2="500" y2="600"/><line x1="300" y1="400" x2="700" y2="400"/></g></svg>`,
  },
  {
    id: 'corporate-executive',
    name: 'Corporate Executive Headquarters',
    category: 'corporate',
    description: 'Clean architectural glass facades & refined enterprise depth',
    thumbnailGradient: 'from-slate-800 via-slate-900 to-zinc-950',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="corpG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23corpG)"/><g stroke="%2394a3b8" stroke-width="1" stroke-opacity="0.12"><line x1="200" y1="0" x2="200" y2="1080"/><line x1="450" y1="0" x2="450" y2="1080"/><line x1="700" y1="0" x2="700" y2="1080"/><line x1="1200" y1="0" x2="1200" y2="1080"/><line x1="1500" y1="0" x2="1500" y2="1080"/><line x1="1750" y1="0" x2="1750" y2="1080"/></g></svg>`,
  },
];
