import assetsData from './assets.json';
import { Settings } from '../types/quotation';

export interface AssetsConfig {
  hdr: string;
  ftr: string;
  wm: string;
  ohdr?: string;
  oftr?: string;
}

export const IMG: AssetsConfig = assetsData.IMG as AssetsConfig;
export const WHITEJ: string = assetsData.WHITEJ;
export const XT: string = assetsData.XT;

/**
 * Returns the effective image data URL for a key (hdr, ftr, wm).
 * Respects user custom image overrides in settings if provided.
 */
export function getAssetImage(key: 'hdr' | 'ftr' | 'wm', settings?: Settings): string {
  if (settings && settings[key] && settings[key].trim()) {
    return settings[key];
  }
  return IMG[key] || '';
}

/**
 * Returns image format: 'JPEG' or 'PNG' based on data URL
 */
export function getImageFormat(dataUrl: string): 'JPEG' | 'PNG' {
  return /image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}
