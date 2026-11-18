import { AppDatabase, Quotation, Settings, CompanyPriceBook, LineItem } from '../types/quotation';
import { INITIAL_DATABASE } from '../data/initialData';
import { cleanKey, parseFlexibleDate, parseNumber } from '../utils/formatters';
import { FileStorageService } from './fileStorageService';

const STORAGE_KEY = 'qm_uic_v2';

export class StorageService {
  private static cachedDb: AppDatabase | null = null;
  private static saveTimeout: any = null;
  public static fileHandle: any = null;
  public static statusMessage: string = '';

  /**
   * Load database from LocalStorage or initialize with seed data.
   */
  public static loadDatabase(): AppDatabase {
    if (this.cachedDb) return this.cachedDb;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const sanitizedPrices: Record<string, CompanyPriceBook> = {};

          // Seed with initial baseline companies
          Object.entries(INITIAL_DATABASE.prices).forEach(([k, v]) => {
            sanitizedPrices[k] = {
              name: v.name || k,
              items: { ...(v.items || {}) },
            };
          });

          // Overlay stored companies safely
          const rawPrices = parsed.prices && typeof parsed.prices === 'object' ? parsed.prices : {};
          Object.entries(rawPrices).forEach(([k, v]: [string, any]) => {
            if (v && typeof v === 'object') {
              sanitizedPrices[k] = {
                name: String(v.name || sanitizedPrices[k]?.name || k),
                items: (v.items && typeof v.items === 'object') ? v.items : (sanitizedPrices[k]?.items || {}),
              };
            }
          });

          const sanitizedQuotes = Array.isArray(parsed.quotes)
            ? parsed.quotes.map((q: any) => ({
                ...q,
                date: parseFlexibleDate(q?.date) || q?.date || '',
              }))
            : [];
          const rawSet = parsed.set || {};
          const sanitizedSet: Settings = { 
            ...INITIAL_DATABASE.set, 
            ...rawSet,
            // Ensure live wallpaper is active if no custom image/video was uploaded
            bgType: (rawSet.bgType === 'video' && rawSet.bgVideoUrl) || (rawSet.bgType === 'image' && rawSet.bgImage)
              ? rawSet.bgType
              : 'canvas',
            bgAnimationPreset: rawSet.bgAnimationPreset || INITIAL_DATABASE.set.bgAnimationPreset || 'particles',
            bgOpacity: typeof rawSet.bgOpacity === 'number' && rawSet.bgOpacity >= 30 ? rawSet.bgOpacity : 80,
            bgPlayState: rawSet.bgPlayState || 'playing',
            bgOverlay: rawSet.bgOverlay || 'none',
          };

          this.cachedDb = {
            quotes: sanitizedQuotes,
            set: sanitizedSet,
            prices: sanitizedPrices,
            pb: 1,
          };
          return this.cachedDb;
        }
      }
    } catch (e) {
      console.warn('Failed to load database from localStorage, initializing defaults:', e);
    }

    const defaultDb: AppDatabase = JSON.parse(JSON.stringify(INITIAL_DATABASE));
    this.cachedDb = defaultDb;
    this.saveDatabaseImmediate(defaultDb);
    return defaultDb;
  }

  /**
   * Schedule debounced save to LocalStorage and linked local file if available.
   */
  public static saveDatabase(db: AppDatabase, onStatusUpdate?: (msg: string) => void): void {
    this.cachedDb = db;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      await this.saveToFileHandle(db);
      if (onStatusUpdate) {
        onStatusUpdate(this.statusMessage);
      }
    }, 600);
  }

  public static saveDatabaseImmediate(db: AppDatabase): void {
    this.cachedDb = db;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('LocalStorage immediate write error:', e);
    }
  }

  /**
   * If user linked a file on their disk via File System Access API
   */
  private static async saveToFileHandle(db: AppDatabase): Promise<void> {
    // 1. If explicit file handle linked
    if (this.fileHandle) {
      try {
        const writable = await this.fileHandle.createWritable();
        await writable.write(JSON.stringify(db, null, 2));
        await writable.close();
        this.statusMessage = `Saved to ${this.fileHandle.name} at ${new Date().toLocaleTimeString()}`;
      } catch (e: any) {
        this.statusMessage = `File save error: ${e?.message || 'Permission denied'}`;
      }
    }

    // 2. If folder / network directory is connected and autoSync is enabled
    if (db.set?.autoSyncDatabaseFile !== false) {
      try {
        const synced = await FileStorageService.syncDatabaseToDirectory(JSON.stringify(db, null, 2));
        if (synced && !this.fileHandle) {
          this.statusMessage = `Synced to folder at ${new Date().toLocaleTimeString()}`;
        }
      } catch {
        // Silently continue
      }
    }
  }

  /**
   * Record items in company price book memory
   */
  public static recordPriceBook(
    db: AppDatabase,
    client: string,
    items: LineItem[],
    date: string,
    ref: string,
    src: string = 'quote'
  ): number {
    const key = cleanKey(client);
    if (!key) return 0;

    if (!db.prices[key]) {
      db.prices[key] = {
        name: client.trim(),
        items: {},
      };
    }

    const company = db.prices[key];
    let recordedCount = 0;

    items.forEach((item) => {
      const desc = String(item.d || '').trim();
      const rate = parseNumber(item.r);
      if (!desc || !(rate > 0)) return;

      const fullDesc = [desc, item.sz, item.cl].filter(Boolean).join(' ');
      const itemKey = cleanKey(fullDesc);

      const historyEntry = {
        r: rate,
        date: date || new Date().toISOString().slice(0, 10),
        ref: ref || '',
        src,
      };

      const existing = company.items[itemKey];
      if (!existing) {
        company.items[itemKey] = {
          d: fullDesc,
          bd: desc,
          sz: item.sz || '',
          cl: item.cl || '',
          r: rate,
          date: historyEntry.date,
          h: [historyEntry],
        };
      } else {
        const prevIndex = existing.h.findIndex((x) => x.date <= historyEntry.date);
        if (prevIndex >= 0 && existing.h[prevIndex].r === rate) {
          if (historyEntry.date > existing.h[prevIndex].date) {
            existing.h[prevIndex].date = historyEntry.date;
          }
        } else if (!existing.h.some((x) => x.r === rate && x.date === historyEntry.date)) {
          existing.h.push(historyEntry);
          existing.h.sort((a, b) => b.date.localeCompare(a.date));
          existing.h = existing.h.slice(0, 15);
        }
        existing.r = existing.h[0].r;
        existing.date = existing.h[0].date;
        if (historyEntry.date >= existing.date) {
          existing.d = fullDesc;
          existing.bd = desc;
        }
      }
      recordedCount++;
    });

    return recordedCount;
  }

  /**
   * Export database as downloadable JSON file
   */
  public static exportDatabaseJson(db: AppDatabase): void {
    const jsonStr = JSON.stringify(db, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UIC-Quotation-Database-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Import database from JSON string
   */
  public static importDatabaseJson(jsonStr: string): AppDatabase {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.quotes && !parsed.prices) {
      throw new Error('Invalid JSON format: missing quotes or prices property.');
    }

    const validated: AppDatabase = {
      quotes: parsed.quotes || [],
      set: { ...INITIAL_DATABASE.set, ...(parsed.set || {}) },
      prices: parsed.prices || {},
      pb: 1,
    };

    this.saveDatabaseImmediate(validated);
    return validated;
  }
}
