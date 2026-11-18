export interface ProceduralAnimationPreset {
  id: string;
  name: string;
  tagline: string;
  category: 'cyber' | 'industrial' | 'ocean' | 'automotive' | 'space' | 'code';
  previewGradient: string;
  description: string;
}

export const PROCEDURAL_ANIMATIONS: ProceduralAnimationPreset[] = [
  {
    id: 'frost-bokeh',
    name: 'Frosted Arctic Bokeh & Ice Silk',
    tagline: 'Soft luminous ice-blue & pearl bokeh orbs drifting smoothly behind frosted panes',
    category: 'ocean',
    previewGradient: 'from-sky-300 via-indigo-200 to-cyan-100',
    description: 'Translucent atmospheric light spheres and soft crystalline drift engineered for frosted glass depth.',
  },
  {
    id: 'particles',
    name: 'Industrial Terminal Linked Nodes (Interactive)',
    tagline: 'Slow-moving floating interactive nodes linked by thin laser lines & cursor attraction',
    category: 'industrial',
    previewGradient: 'from-zinc-950 via-red-950 to-neutral-900',
    description: 'Autonomous slow-moving data nodes connected by dynamic thin lines with real-time cursor attraction.',
  },
  {
    id: 'cyber-grid',
    name: '3D Cyber Horizon & Neon Grid',
    tagline: 'Neo-Tokyo synthwave 3D ground lines with glowing purple horizon',
    category: 'cyber',
    previewGradient: 'from-fuchsia-950 via-purple-950 to-slate-950',
    description: 'Dynamic forward-moving 3D perspective grid with vibrant neon horizon glow.',
  },
  {
    id: 'particle-mesh',
    name: 'Industrial Laser Lattice & Mesh',
    tagline: 'Floating inspection nodes and real-time connecting laser links',
    category: 'industrial',
    previewGradient: 'from-blue-950 via-slate-900 to-indigo-950',
    description: 'Autonomous floating data nodes forming real-time engineering connection lines.',
  },
  {
    id: 'ocean-flow',
    name: 'Fluid Aquatic Waves & Currents',
    tagline: 'Multi-layer undulating fluid sine waves & deep sea caustics',
    category: 'ocean',
    previewGradient: 'from-cyan-950 via-teal-950 to-slate-950',
    description: 'Calming multi-frequency oceanic water currents flowing with smooth organic physics.',
  },
  {
    id: 'anime-sakura',
    name: 'Cyber Anime & Sakura Blossom Drift',
    tagline: 'Fluttering Japanese cherry blossoms with Neo-Tokyo magenta neon glow',
    category: 'cyber',
    previewGradient: 'from-pink-950 via-purple-950 to-slate-950',
    description: 'Organic cherry blossom petals drifting with 3D tumbling physics and soft ambient glow.',
  },
  {
    id: 'mechanical-gears',
    name: 'Industrial Blueprint & Rotating Gears',
    tagline: 'Synchronized mechanical gear train, CAD crosshairs & engineering drafting grid',
    category: 'industrial',
    previewGradient: 'from-orange-950 via-stone-900 to-zinc-950',
    description: 'Precision mechanical gears rotating in synchronization with CAD technical crosshairs.',
  },
  {
    id: 'speed-telemetry',
    name: 'Motorsport Speed HUD & Photon Trails',
    tagline: 'High-velocity light streaks and racing aerodynamic telemetry',
    category: 'automotive',
    previewGradient: 'from-red-950 via-neutral-950 to-zinc-950',
    description: 'Horizontal hyper-speed energy streaks simulating racetrack cockpit velocity.',
  },
  {
    id: 'constellation',
    name: 'Stellar Constellation & Nebula Drift',
    tagline: 'Deep space starfield with gentle galactic twinkling and cosmic depth',
    category: 'space',
    previewGradient: 'from-indigo-950 via-slate-950 to-zinc-950',
    description: 'Subtle drifting night sky stars and deep astronomical ambient luminescence.',
  },
  {
    id: 'matrix',
    name: 'Digital Matrix & Telemetry Stream',
    tagline: 'High-tech falling code glyphs with emerald phosphorescence',
    category: 'code',
    previewGradient: 'from-emerald-950 via-slate-950 to-zinc-950',
    description: 'Gentle falling binary characters creating a clean developer command-center backdrop.',
  },
];

export interface WebVideoPreset {
  id: string;
  name: string;
  url: string;
  category: string;
  thumbnail: string;
  description: string;
}

/**
 * Curated high-performance royalty-free ambient web video loops (MP4 / WebM)
 * Lightweight, high-quality, seamless infinite loops from public CDNs.
 */
export const WEB_VIDEO_PRESETS: WebVideoPreset[] = [
  {
    id: 'fluid-waves',
    name: 'Deep Blue Fluid Waves',
    url: 'https://cdn.pixabay.com/video/2019/04/16/22883-331298495_tiny.mp4',
    category: 'Ocean & Fluid',
    thumbnail: 'from-cyan-900 via-blue-950 to-slate-950',
    description: 'Smooth undulating blue marine waves with atmospheric light refractions.',
  },
  {
    id: 'digital-plexus',
    name: 'Cybernetic Tech Nodes',
    url: 'https://cdn.pixabay.com/video/2019/04/23/23011-332479428_tiny.mp4',
    category: 'Industrial Tech',
    thumbnail: 'from-blue-950 via-indigo-950 to-slate-950',
    description: 'Floating connected geometric network lines with ambient light pulses.',
  },
  {
    id: 'industrial-sparks',
    name: 'Industrial Precision Welding & Sparks',
    url: 'https://cdn.pixabay.com/video/2020/05/25/40149-425026909_tiny.mp4',
    category: 'Inspection & Engineering',
    thumbnail: 'from-amber-950 via-orange-950 to-slate-950',
    description: 'High-precision manufacturing sparks and steel fabrication illumination.',
  },
  {
    id: 'night-highway-speed',
    name: 'Speed Highway Light Trails',
    url: 'https://cdn.pixabay.com/video/2020/06/18/42491-432860477_tiny.mp4',
    category: 'Automotive',
    thumbnail: 'from-red-950 via-rose-950 to-slate-950',
    description: 'Long-exposure night traffic and high-speed road telemetry motion.',
  },
  {
    id: 'space-stars',
    name: 'Cosmic Starfield & Galaxy Voyage',
    url: 'https://cdn.pixabay.com/video/2020/04/14/36109-411309852_tiny.mp4',
    category: 'Space & Nebula',
    thumbnail: 'from-purple-950 via-slate-950 to-zinc-950',
    description: 'Infinite deep space stellar flight with ambient nebula clusters.',
  },
];

/**
 * Downloads a web video or animation from the internet and converts it to a base64 Data URL
 * so that it works 100% offline without requiring any active internet connection!
 */
export async function downloadWebMediaToOfflineBase64(
  url: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  try {
    if (onProgress) onProgress('Connecting to web video stream...');
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to download media: HTTP ${response.status} ${response.statusText}`);
    }

    if (onProgress) onProgress('Downloading media packets...');
    const blob = await response.blob();
    
    // Check reasonable size for local storage (under 12MB)
    if (blob.size > 12 * 1024 * 1024) {
      throw new Error(`Downloaded media is too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Max recommended offline size is 12MB.`);
    }

    if (onProgress) onProgress('Encoding for offline local storage...');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          success: true,
          dataUrl: reader.result as string,
        });
      };
      reader.onerror = () => {
        resolve({
          success: false,
          error: 'FileReader error occurred while converting video.',
        });
      };
      reader.readAsDataURL(blob);
    });
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Could not download media from the provided URL.',
    };
  }
}
