import { AppTheme } from '../types/quotation';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  tagline: string;
  vibe: string;             // Short mood tag e.g. "Oceanic", "Cyber", "Industrial"
  primary: string;          // Hex e.g. #1E3A8A
  primaryHover: string;     // Hex e.g. #1E40AF
  primaryDark: string;      // Hex e.g. #172554
  lightBg: string;          // Hex e.g. #EFF6FF
  border: string;           // Hex e.g. #BFDBFE
  ring: string;             // Hex e.g. #3B82F6
  previewGradient: string;  // CSS gradient for swatch
  headerBgClass: string;
  badgeClass: string;
  buttonClass: string;
  bgPatternName: string;    // Name of pattern displayed in background
  accentEmoji: string;      // Quick visual symbol
}

export const THEMES: ThemeConfig[] = [
  // 0. Variation 23: Industrial Terminal (Design Variation 23 Default)
  {
    id: 'terminal',
    name: 'Variation 23: Industrial Terminal',
    tagline: 'Deep obsidian surface, Syne typography & precision crimson accent',
    vibe: 'Industrial Terminal',
    primary: '#FF3B30',
    primaryHover: '#E03126',
    primaryDark: '#B3261E',
    lightBg: '#111113',
    border: 'rgba(228, 228, 231, 0.12)',
    ring: '#FF3B30',
    previewGradient: 'from-zinc-950 via-zinc-900 to-red-600',
    headerBgClass: 'bg-[#1C1C1E]',
    badgeClass: 'bg-[#1C1C1E] text-zinc-200 border-zinc-700',
    buttonClass: 'bg-[#FF3B30] hover:bg-[#E03126] text-white',
    bgPatternName: 'Deep Obsidian Dark Canvas & Precision Crimson Accent',
    accentEmoji: '⚡',
  },

  // 1. User-Requested: Frosted Glass Theme
  {
    id: 'frosted',
    name: 'Frosted Arctic Glass',
    tagline: 'Translucent ice-glass panels, backdrop blur & luminous crystalline edges',
    vibe: 'Frosted Glassmorphism',
    primary: '#0284C7',
    primaryHover: '#0369A1',
    primaryDark: '#0C4A6E',
    lightBg: '#DFF0FC',
    border: 'rgba(255, 255, 255, 0.72)',
    ring: '#38BDF8',
    previewGradient: 'from-sky-200 via-indigo-100 to-white',
    headerBgClass: 'bg-sky-700',
    badgeClass: 'bg-white/70 text-sky-900 border-white/80',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white',
    bgPatternName: 'Translucent Frosted Glass & Glacial Aurora Blur',
    accentEmoji: '❄️',
  },

  // 1. User-Requested: Ocean Theme
  {
    id: 'ocean',
    name: 'Deep Ocean & Aqua Waves',
    tagline: 'Flowing marine currents, aquamarine waves & deep sea backdrop',
    vibe: 'Oceanic & Fluid',
    primary: '#0891B2',
    primaryHover: '#0E7490',
    primaryDark: '#083344',
    lightBg: '#F0FDFA',
    border: '#A5F3FC',
    ring: '#06B6D4',
    previewGradient: 'from-cyan-900 via-teal-700 to-cyan-500',
    headerBgClass: 'bg-cyan-800',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-800 active:bg-cyan-900 text-white',
    bgPatternName: 'Oceanic Wave Ripples & Aquatic Depth',
    accentEmoji: '🌊',
  },

  // 2. User-Requested: Anime Theme
  {
    id: 'anime',
    name: 'Cyber Anime & Sakura Neon',
    tagline: 'Neo-Tokyo cyberpunk glow, sakura pink accents & anime digital grid',
    vibe: 'Cyber Anime',
    primary: '#9333EA',
    primaryHover: '#7E22CE',
    primaryDark: '#3B0764',
    lightBg: '#FAF5FF',
    border: '#E9D5FF',
    ring: '#C084FC',
    previewGradient: 'from-purple-950 via-fuchsia-800 to-pink-500',
    headerBgClass: 'bg-purple-900',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    buttonClass: 'bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white',
    bgPatternName: 'Neo-Tokyo Digital Grid & Sakura Ambient Glow',
    accentEmoji: '🌸',
  },

  // 3. User-Requested: Mechanical Theme
  {
    id: 'mechanical',
    name: 'Industrial Mechanical & Blueprint',
    tagline: 'Precision machinery, technical blueprint grid & brushed steel',
    vibe: 'Heavy Engineering',
    primary: '#EA580C',
    primaryHover: '#C2410C',
    primaryDark: '#7C2D12',
    lightBg: '#FFF7ED',
    border: '#FED7AA',
    ring: '#F97316',
    previewGradient: 'from-zinc-900 via-stone-800 to-orange-700',
    headerBgClass: 'bg-stone-900',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    buttonClass: 'bg-orange-700 hover:bg-orange-800 active:bg-orange-900 text-white',
    bgPatternName: 'Precision Technical Blueprint & Steel Grid',
    accentEmoji: '⚙️',
  },

  // 4. User-Requested: Car Theme
  {
    id: 'car',
    name: 'Motorsport & Carbon Fiber',
    tagline: 'Racing crimson red, carbon fiber weave & tachometer cockpit vibe',
    vibe: 'Automotive Performance',
    primary: '#DC2626',
    primaryHover: '#B91C1C',
    primaryDark: '#7F1D1D',
    lightBg: '#FEF2F2',
    border: '#FECACA',
    ring: '#EF4444',
    previewGradient: 'from-black via-zinc-900 to-red-600',
    headerBgClass: 'bg-zinc-950',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    buttonClass: 'bg-red-700 hover:bg-red-800 active:bg-red-900 text-white',
    bgPatternName: 'Carbon Fiber Weave Texture & Racing Stripe Accent',
    accentEmoji: '🏎️',
  },

  // 5. Official UIC Royal Navy (Default)
  {
    id: 'navy',
    name: 'Corporate Royal Navy',
    tagline: 'Official UIC dark navy blue with precision corporate grid',
    vibe: 'UIC Official Corporate',
    primary: '#1E3A8A',
    primaryHover: '#1D4ED8',
    primaryDark: '#172554',
    lightBg: '#EFF6FF',
    border: '#BFDBFE',
    ring: '#3B82F6',
    previewGradient: 'from-blue-950 via-blue-900 to-blue-700',
    headerBgClass: 'bg-blue-800',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    buttonClass: 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white',
    bgPatternName: 'Corporate Blue Engineering Grid',
    accentEmoji: '🏛️',
  },

  // 6. Executive Slate
  {
    id: 'slate',
    name: 'Executive Slate & Steel',
    tagline: 'Minimalist executive slate & architectural drafting mesh',
    vibe: 'Executive Modern',
    primary: '#1E293B',
    primaryHover: '#334155',
    primaryDark: '#0F172A',
    lightBg: '#F8FAFC',
    border: '#CBD5E1',
    ring: '#64748B',
    previewGradient: 'from-slate-950 via-slate-800 to-slate-700',
    headerBgClass: 'bg-slate-800',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    buttonClass: 'bg-slate-800 hover:bg-slate-900 text-white',
    bgPatternName: 'Architectural Slate Texture',
    accentEmoji: '📐',
  },

  // 7. Emerald Inspection
  {
    id: 'emerald',
    name: 'Emerald Inspection',
    tagline: 'Precision calibration green with honeycomb lattice',
    vibe: 'Quality Assurance',
    primary: '#065F46',
    primaryHover: '#047857',
    primaryDark: '#064E3B',
    lightBg: '#ECFDF5',
    border: '#A7F3D0',
    ring: '#10B981',
    previewGradient: 'from-emerald-950 via-emerald-800 to-emerald-600',
    headerBgClass: 'bg-emerald-800',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white',
    bgPatternName: 'Hexagonal Calibration Lattice',
    accentEmoji: '🔍',
  },

  // 8. Midnight Indigo
  {
    id: 'midnight',
    name: 'Midnight Indigo & Stars',
    tagline: 'High-contrast midnight indigo with celestial starfield glow',
    vibe: 'Night Vision',
    primary: '#312E81',
    primaryHover: '#3730A3',
    primaryDark: '#1E1B4B',
    lightBg: '#EEF2FF',
    border: '#C7D2FE',
    ring: '#6366F1',
    previewGradient: 'from-indigo-950 via-indigo-900 to-indigo-700',
    headerBgClass: 'bg-indigo-900',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white',
    bgPatternName: 'Stellar Night Sky & Cosmic Depth',
    accentEmoji: '✨',
  },

  // 9. Modern Sapphire
  {
    id: 'sapphire',
    name: 'Modern Sapphire Sky',
    tagline: 'Vibrant technical engineering cyan-blue drafting pattern',
    vibe: 'High-Tech Cyan',
    primary: '#0369A1',
    primaryHover: '#0284C7',
    primaryDark: '#0C4A6E',
    lightBg: '#F0F9FF',
    border: '#BAE6FD',
    ring: '#0EA5E9',
    previewGradient: 'from-sky-950 via-sky-800 to-sky-600',
    headerBgClass: 'bg-sky-800',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    buttonClass: 'bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white',
    bgPatternName: 'Technical Drafting Sapphire Grid',
    accentEmoji: '💎',
  },

  // 10. Industrial Amber
  {
    id: 'amber',
    name: 'Industrial Amber Bronze',
    tagline: 'Warm heavy industrial brass & crosshatch engineering texture',
    vibe: 'Heavy Industrial',
    primary: '#92400E',
    primaryHover: '#B45309',
    primaryDark: '#78350F',
    lightBg: '#FFFBEB',
    border: '#FDE68A',
    ring: '#F59E0B',
    previewGradient: 'from-amber-950 via-amber-800 to-amber-600',
    headerBgClass: 'bg-amber-800',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    buttonClass: 'bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white',
    bgPatternName: 'Industrial Brass Micro-Hatching',
    accentEmoji: '⚡',
  },
];

export function getTheme(id?: AppTheme): ThemeConfig {
  const found = THEMES.find((t) => t.id === id);
  return found || THEMES[0]; // Default to Variation 23 Industrial Terminal
}

/**
 * Injects CSS variables and sets data-theme on document root
 */
export function applyTheme(themeId?: AppTheme): ThemeConfig {
  const theme = getTheme(themeId);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const isDark = theme.id === 'terminal';
    
    root.setAttribute('data-theme', theme.id);
    root.classList.toggle('dark', isDark);
    
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-hover', theme.primaryHover);
    root.style.setProperty('--color-primary-dark', theme.primaryDark);
    root.style.setProperty('--color-light-bg', theme.lightBg);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-ring', theme.ring);

    // Adaptive Theme Tokens (Variation 23 Obsidian Dark vs Enterprise Light)
    if (isDark) {
      root.style.setProperty('--bg', '#111113');
      root.style.setProperty('--surface', 'rgba(28, 28, 30, 0.90)');
      root.style.setProperty('--surface-card', 'rgba(39, 39, 42, 0.88)');
      root.style.setProperty('--surface-input', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--surface-input-border', 'rgba(228, 228, 231, 0.20)');
      root.style.setProperty('--accent', '#FF3B30');
      root.style.setProperty('--border', 'rgba(228, 228, 231, 0.14)');
      root.style.setProperty('--border-subtle', 'rgba(228, 228, 231, 0.07)');
      root.style.setProperty('--ink', '#F4F4F5');
      root.style.setProperty('--ink-secondary', 'rgba(228, 228, 231, 0.78)');
      root.style.setProperty('--ink-faint', 'rgba(228, 228, 231, 0.52)');
      root.style.setProperty('--ink-muted', 'rgba(228, 228, 231, 0.38)');
    } else if (theme.id === 'frosted') {
      root.style.setProperty('--bg', '#DFF0FC');
      root.style.setProperty('--surface', 'rgba(255, 255, 255, 0.56)');
      root.style.setProperty('--surface-card', 'rgba(255, 255, 255, 0.50)');
      root.style.setProperty('--surface-input', 'rgba(255, 255, 255, 0.72)');
      root.style.setProperty('--surface-input-border', 'rgba(14, 116, 144, 0.22)');
      root.style.setProperty('--accent', '#0284C7');
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.74)');
      root.style.setProperty('--border-subtle', 'rgba(15, 23, 42, 0.08)');
      root.style.setProperty('--ink', '#0F172A');
      root.style.setProperty('--ink-secondary', '#334155');
      root.style.setProperty('--ink-faint', '#475569');
      root.style.setProperty('--ink-muted', '#64748B');
    } else {
      root.style.setProperty('--bg', theme.lightBg);
      root.style.setProperty('--surface', 'rgba(255, 255, 255, 0.92)');
      root.style.setProperty('--surface-card', '#FFFFFF');
      root.style.setProperty('--surface-input', '#FFFFFF');
      root.style.setProperty('--surface-input-border', theme.border);
      root.style.setProperty('--accent', theme.primary);
      root.style.setProperty('--border', theme.border);
      root.style.setProperty('--border-subtle', 'rgba(0, 0, 0, 0.06)');
      root.style.setProperty('--ink', '#0F172A');
      root.style.setProperty('--ink-secondary', '#334155');
      root.style.setProperty('--ink-faint', '#64748B');
      root.style.setProperty('--ink-muted', '#94A3B8');
    }
  }
  return theme;
}

/**
 * Returns the signature 60FPS procedural canvas live animation for a given theme
 */
export function getThemeDefaultAnimation(themeId?: string): string {
  switch (themeId) {
    case 'frosted':
      return 'frost-bokeh';
    case 'ocean':
      return 'ocean-flow';
    case 'anime':
      return 'anime-sakura';
    case 'mechanical':
      return 'mechanical-gears';
    case 'car':
      return 'speed-telemetry';
    case 'navy':
      return 'particle-mesh';
    case 'midnight':
      return 'constellation';
    case 'emerald':
      return 'matrix';
    case 'terminal':
    default:
      return 'particles';
  }
}
