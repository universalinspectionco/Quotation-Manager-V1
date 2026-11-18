export type QuoteType = 'std' | 'valve';

export type QuoteStatus =
  | 'Draft'
  | 'Waiting For PO'
  | 'Job Received'
  | 'Under Process'
  | 'Completed'
  | 'Lost';

export interface LineItem {
  d: string;        // Description
  q: number;        // Quantity
  r: number;        // Rate (SAR)
  sns?: string;     // Serial numbers (newline or comma separated)
  sz?: string;      // Valve size in inches (e.g. 2", 3", 4")
  cl?: string;      // Valve class rating (e.g. 150#, 300#, 600#)
  rm?: string;      // Remarks (e.g. Pass or Fail, Hydrotest, etc.)
}

export interface Quotation {
  id: string;
  type: QuoteType;
  ref: string;
  date: string;
  client: string;
  attn: string;
  location: string;
  title: string;
  sub?: string;          // Valve quote subject line
  revised?: boolean;     // Add "REVISED" to title
  rateNote?: string;     // e.g. "(Pass or Fail)"
  vatNote?: string;      // e.g. "Vat 15% will be added to all invoices"
  showTot?: boolean;     // Show total rows on valve quote
  showRm?: boolean;      // Show remarks column on standard quote
  via?: string;          // Sent via (Email, Hand, WhatsApp)
  clientCode?: string;   // Corporate client code
  svc?: string;          // Service type (Calibration, NDT, Valve Test)
  dept?: string;         // Department
  spDept?: string;       // Specific department
  delivery: string;
  service: string;
  intro: string;
  items: LineItem[];
  tc: string;            // Terms and conditions
  vat: number;           // VAT percentage
  status: QuoteStatus;
  notes: string;         // Follow-up notes / remarks
  closing: string;
  sign: boolean;         // Whether to attach digital signature
  isNew?: boolean;
}

export interface PriceHistoryEntry {
  r: number;
  date: string;
  ref: string;
  src?: string;
}

export interface PriceBookItem {
  d: string;          // Full description
  bd?: string;        // Base description
  sz?: string;        // Size
  cl?: string;        // Class
  c?: string;         // Short code (e.g. "eh", "pr-1")
  r: number;          // Current rate
  date: string;       // Last updated date
  h: PriceHistoryEntry[]; // Historical rates
}

export interface CompanyPriceBook {
  name: string;
  items: Record<string, PriceBookItem>;
}

export interface Settings {
  tc: string;
  prefix: string;
  next: number;
  delivery: string;
  service: string;
  intro: string;
  closing: string;
  title: string;
  vat: number;
  signer: string;
  role: string;
  sig: string;         // Base64 signature image
  hdr: string;         // Base64 header image
  ftr: string;         // Base64 footer image
  wm: string;          // Base64 watermark image
  v: number;
  lh: 'band' | 'orig' | 'none'; // Letterhead style
  titleV: string;
  subV: string;
  rateNote: string;
  vatNote: string;
  tcv: string;
  // Local & Network Folder Storage Configuration
  defaultStoragePath?: string;      // Custom path name e.g. "C:\Quotes" or "\\192.168.1.100\Shared\Quotes"
  defaultFolderName?: string;       // Display name or folder identifier
  storageSaveMode?: 'dialog' | 'direct' | 'download'; // 'dialog': pop up native Windows Save File window; 'direct': save directly to connected folder; 'download': browser default download
  autoSyncDatabaseFile?: boolean;   // Auto-sync database JSON to chosen folder/file
  theme?: AppTheme;                 // Professional color theme
  // Custom Background Picture & Live Animation Wallpaper
  bgType?: 'image' | 'video' | 'canvas'; // Type of background
  bgImage?: string;                  // Base64 data URL or preset picture
  bgVideoUrl?: string;               // Web video URL (.mp4, .webm) or downloaded/cached base64
  bgAnimationPreset?: string;        // Procedural live canvas animation ID ('cyber-grid', 'particle-mesh', 'ocean-flow', 'speed-telemetry', 'constellation', 'matrix')
  bgPlayState?: 'playing' | 'paused';// Live animation playback state
  bgPlaybackSpeed?: number;          // Playback speed (0.5 to 2.0)
  bgOpacity?: number;                // Opacity percentage (e.g. 15 for 15%)
  bgBlur?: number;                   // Blur in px (e.g. 0 to 12)
  bgOverlay?: 'light' | 'dark' | 'theme' | 'none'; // Contrast protection overlay
}

export type AppTheme = 
  | 'terminal'
  | 'frosted'
  | 'navy' 
  | 'ocean' 
  | 'anime' 
  | 'mechanical' 
  | 'car' 
  | 'slate' 
  | 'emerald' 
  | 'midnight' 
  | 'sapphire' 
  | 'amber';

export interface AppDatabase {
  quotes: Quotation[];
  set: Settings;
  prices: Record<string, CompanyPriceBook>;
  pb?: number;
}
