/**
 * FileStorageService
 * Handles local folder/network drive selection and file saving via File System Access API
 * Supports both:
 * 1. Native Windows "Save As" Pop-up File Dialog (window.showSaveFilePicker) defaulting to configured folder
 * 2. Direct-to-Folder Save (window.showDirectoryPicker handle) for one-click storage on local or network folders
 * 3. Browser fallback download
 */

import { Settings } from '../types/quotation';

const IDB_NAME = 'uic_file_storage_db';
const IDB_STORE = 'handles';
const DIR_KEY = 'default_storage_directory';

// Open or initialize IndexedDB store for Directory Handles
function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported'));
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Store a DirectoryHandle in IndexedDB
async function storeDirectoryHandle(handle: any): Promise<void> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(handle, DIR_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not store directory handle in IndexedDB:', e);
  }
}

// Retrieve stored DirectoryHandle from IndexedDB
async function getStoredDirectoryHandle(): Promise<any | null> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(DIR_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Clear stored DirectoryHandle from IndexedDB
async function removeStoredDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(DIR_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not remove directory handle:', e);
  }
}

export interface SaveFileOptions {
  blob: Blob;
  filename: string;
  mimeType: string;
  description: string;
  extension: string;
  settings?: Settings;
  modeOverride?: 'dialog' | 'direct' | 'download';
}

export interface SaveResult {
  success: boolean;
  method: 'dialog' | 'direct' | 'download';
  filename: string;
  folderName?: string;
  message: string;
}

export class FileStorageService {
  private static cachedDirHandle: any = null;

  /**
   * Check if the File System Access API is supported by the current browser
   */
  public static isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  public static isDirectoryPickerSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Select a local directory or network folder using Windows Folder Browser
   */
  public static async selectDefaultDirectory(): Promise<{ handle: any; name: string } | null> {
    if (!this.isDirectoryPickerSupported()) {
      alert('Your browser does not support the File System Access API. Please use Microsoft Edge, Google Chrome, or the standalone Windows desktop app.');
      return null;
    }

    try {
      // Prompt user to pick any folder or mapped network drive
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Verify write permission
      if (handle.requestPermission) {
        const perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          alert('Read & Write permission was not granted for the selected folder.');
          return null;
        }
      }

      this.cachedDirHandle = handle;
      await storeDirectoryHandle(handle);

      return {
        handle,
        name: handle.name,
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // User cancelled picker dialog
        return null;
      }
      console.error('Directory selection failed:', e);
      alert(`Could not select folder: ${e.message || 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Get the active or restored DirectoryHandle with write permission verified
   */
  public static async getActiveDirectoryHandle(requestIfPrompt: boolean = false): Promise<any | null> {
    if (this.cachedDirHandle) {
      try {
        const query = await this.cachedDirHandle.queryPermission?.({ mode: 'readwrite' });
        if (query === 'granted') return this.cachedDirHandle;
        if (requestIfPrompt && this.cachedDirHandle.requestPermission) {
          const req = await this.cachedDirHandle.requestPermission({ mode: 'readwrite' });
          if (req === 'granted') return this.cachedDirHandle;
        }
      } catch {
        // Handle might be stale
      }
    }

    const stored = await getStoredDirectoryHandle();
    if (!stored) return null;

    try {
      const query = await stored.queryPermission?.({ mode: 'readwrite' });
      if (query === 'granted') {
        this.cachedDirHandle = stored;
        return stored;
      }
      if (requestIfPrompt && stored.requestPermission) {
        const req = await stored.requestPermission({ mode: 'readwrite' });
        if (req === 'granted') {
          this.cachedDirHandle = stored;
          return stored;
        }
      }
      this.cachedDirHandle = stored;
      return stored;
    } catch (e) {
      console.warn('Failed to query permission for stored directory:', e);
      return null;
    }
  }

  /**
   * Disconnect the selected directory
   */
  public static async disconnectDirectory(): Promise<void> {
    this.cachedDirHandle = null;
    await removeStoredDirectoryHandle();
  }

  /**
   * Save a file according to user settings:
   * 1. 'dialog' (default requested): Opens the native Windows "Save As" file picker dialog window, defaulting to their chosen folder
   * 2. 'direct': Directly writes into the connected local folder or network share without prompting
   * 3. 'download': Standard browser download fallback
   */
  public static async saveFile(options: SaveFileOptions): Promise<SaveResult> {
    const { blob, filename, mimeType, description, extension, settings, modeOverride } = options;
    const saveMode = modeOverride || settings?.storageSaveMode || 'dialog';
    const dirHandle = await this.getActiveDirectoryHandle(false);

    // MODE 1: Direct Save to selected folder or network drive
    if (saveMode === 'direct' && dirHandle) {
      try {
        // Request permission if not already granted
        let hasPerm = false;
        try {
          const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            hasPerm = true;
          } else if (dirHandle.requestPermission) {
            const req = await dirHandle.requestPermission({ mode: 'readwrite' });
            hasPerm = req === 'granted';
          }
        } catch {
          hasPerm = true;
        }

        if (hasPerm) {
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          return {
            success: true,
            method: 'direct',
            filename,
            folderName: dirHandle.name,
            message: `File saved directly to folder: ${dirHandle.name}\\${filename}`,
          };
        }
      } catch (e: any) {
        console.warn('Direct folder save failed, falling back to Save Dialog:', e);
      }
    }

    // MODE 2: Native Windows "Save As" File Dialog Window (showSaveFilePicker)
    if (saveMode === 'dialog' || saveMode === 'direct') {
      if (this.isFileSystemAccessSupported()) {
        try {
          const pickerOpts: any = {
            suggestedName: filename,
            types: [
              {
                description: description || 'Document',
                accept: {
                  [mimeType]: [extension],
                },
              },
            ],
          };

          // If a directory handle is connected, open the Windows Save Dialog starting in that folder!
          if (dirHandle) {
            pickerOpts.startIn = dirHandle;
          }

          const fileHandle = await (window as any).showSaveFilePicker(pickerOpts);
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          return {
            success: true,
            method: 'dialog',
            filename: fileHandle.name || filename,
            message: `File saved successfully as: ${fileHandle.name || filename}`,
          };
        } catch (e: any) {
          if (e.name === 'AbortError') {
            // User cancelled the Windows file save dialog
            return {
              success: false,
              method: 'dialog',
              filename,
              message: 'Save cancelled by user.',
            };
          }
          console.warn('Save file picker failed, falling back to download:', e);
        }
      }
    }

    // MODE 3: Fallback standard browser download
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      return {
        success: true,
        method: 'download',
        filename,
        message: `File downloaded: ${filename}`,
      };
    } catch (e: any) {
      return {
        success: false,
        method: 'download',
        filename,
        message: `Failed to download file: ${e?.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Directly write a blob into a DirectoryHandle without popup prompts
   */
  public static async writeBlobToDirectory(
    dirHandle: any,
    blob: Blob,
    filename: string
  ): Promise<boolean> {
    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      console.error(`Failed to write ${filename} to directory:`, e);
      return false;
    }
  }

  /**
   * Save both PDF and Excel directly into the connected default directory
   */
  public static async saveBothToDefaultDirectory(
    pdfBlob: Blob,
    pdfFilename: string,
    excelBlob: Blob,
    excelFilename: string
  ): Promise<{
    success: boolean;
    folderName?: string;
    pdfSaved: boolean;
    excelSaved: boolean;
    message: string;
  }> {
    const dirHandle = await this.getActiveDirectoryHandle(false);
    if (!dirHandle) {
      return {
        success: false,
        pdfSaved: false,
        excelSaved: false,
        message: 'No default folder connected yet. Please select a folder first.',
      };
    }

    try {
      // Check permissions
      let perm = 'granted';
      try {
        perm = (await dirHandle.queryPermission?.({ mode: 'readwrite' })) || 'granted';
      } catch {}

      if (perm !== 'granted') {
        return {
          success: false,
          folderName: dirHandle.name,
          pdfSaved: false,
          excelSaved: false,
          message: `Permission to access folder "${dirHandle.name}" has expired. Click below to reconnect.`,
        };
      }

      const pdfOk = await this.writeBlobToDirectory(dirHandle, pdfBlob, pdfFilename);
      const excelOk = await this.writeBlobToDirectory(dirHandle, excelBlob, excelFilename);

      return {
        success: pdfOk && excelOk,
        folderName: dirHandle.name,
        pdfSaved: pdfOk,
        excelSaved: excelOk,
        message: pdfOk && excelOk
          ? `Both PDF and Excel files saved to folder "${dirHandle.name}".`
          : `Saved partial files to folder "${dirHandle.name}".`,
      };
    } catch (e: any) {
      return {
        success: false,
        folderName: dirHandle.name,
        pdfSaved: false,
        excelSaved: false,
        message: e?.message || 'Failed to save files to default folder.',
      };
    }
  }

  /**
   * Explicitly open the native Windows Save File Dialog window for a file
   */
  public static async openNativeSaveDialog(
    blob: Blob,
    filename: string,
    mimeType: string,
    extension: string,
    description: string
  ): Promise<SaveResult> {
    const dirHandle = await this.getActiveDirectoryHandle(false);
    if (this.isFileSystemAccessSupported()) {
      try {
        const pickerOpts: any = {
          suggestedName: filename,
          types: [
            {
              description: description || 'Document',
              accept: {
                [mimeType]: [extension],
              },
            },
          ],
        };
        if (dirHandle) {
          pickerOpts.startIn = dirHandle;
        }

        const fileHandle = await (window as any).showSaveFilePicker(pickerOpts);
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return {
          success: true,
          method: 'dialog',
          filename: fileHandle.name || filename,
          message: `File saved successfully as: ${fileHandle.name || filename}`,
        };
      } catch (e: any) {
        if (e.name === 'AbortError') {
          return {
            success: false,
            method: 'dialog',
            filename,
            message: 'Save cancelled by user.',
          };
        }
      }
    }

    // Fallback standard download
    return this.saveFile({
      blob,
      filename,
      mimeType,
      description,
      extension,
      modeOverride: 'download',
    });
  }

  /**
   * Helper to write database JSON to connected folder automatically
   */
  public static async syncDatabaseToDirectory(dbJsonStr: string): Promise<boolean> {
    const dirHandle = await this.getActiveDirectoryHandle(false);
    if (!dirHandle) return false;

    try {
      const dbFileHandle = await dirHandle.getFileHandle('UIC_Quotation_Database.json', { create: true });
      const writable = await dbFileHandle.createWritable();
      await writable.write(dbJsonStr);
      await writable.close();
      return true;
    } catch (e) {
      console.warn('Auto-sync database to directory failed:', e);
      return false;
    }
  }
}
