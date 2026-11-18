import React, { useState, useRef } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Sparkles, 
  Sliders, 
  Play, 
  Pause, 
  Globe, 
  Download, 
  Film, 
  Activity, 
  Check, 
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Info
} from 'lucide-react';
import { Settings } from '../types/quotation';
import { BACKGROUND_PRESETS } from '../utils/backgroundPresets';
import { 
  PROCEDURAL_ANIMATIONS, 
  WEB_VIDEO_PRESETS, 
  downloadWebMediaToOfflineBase64 
} from '../utils/liveWallpaperPresets';
import { getTheme } from '../utils/theme';

interface BackgroundPictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (newSettings: Settings) => void;
}

export const BackgroundPictureModal: React.FC<BackgroundPictureModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'web-video' | 'procedural' | 'upload' | 'presets'>('web-video');
  const [customWebUrl, setCustomWebUrl] = useState<string>(settings.bgVideoUrl || '');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [previewError, setPreviewError] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = getTheme(settings.theme);

  if (!isOpen) return null;

  const currentType = settings.bgType || (settings.bgVideoUrl ? 'video' : settings.bgAnimationPreset ? 'canvas' : settings.bgImage ? 'image' : 'none');
  const currentOpacity = settings.bgOpacity ?? 75;
  const currentBlur = settings.bgBlur ?? 0;
  const currentOverlay = settings.bgOverlay || 'none';
  const currentPlayState = settings.bgPlayState || 'playing';
  const currentSpeed = settings.bgPlaybackSpeed || 1.0;

  // Handle local file upload (supports video mp4/webm, gif, and image jpg/png)
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 14 * 1024 * 1024) {
      alert('File size is too large (over 14MB). Please choose a smaller video or image.');
      return;
    }

    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogv)$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (isVideo) {
        onUpdateSettings({
          ...settings,
          bgType: 'video',
          bgVideoUrl: dataUrl,
          bgImage: '',
          bgAnimationPreset: '',
          bgOpacity: settings.bgOpacity || 20,
          bgPlayState: 'playing',
        });
      } else {
        onUpdateSettings({
          ...settings,
          bgType: 'image',
          bgImage: dataUrl,
          bgVideoUrl: '',
          bgAnimationPreset: '',
          bgOpacity: settings.bgOpacity || 22,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Apply a web video loop URL
  const handleApplyWebVideo = (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setPreviewError('Please enter a valid video URL from the web.');
      return;
    }

    setPreviewError('');
    onUpdateSettings({
      ...settings,
      bgType: 'video',
      bgVideoUrl: cleanUrl,
      bgAnimationPreset: '',
      bgImage: '',
      bgPlayState: 'playing',
      bgOpacity: settings.bgOpacity || 20,
    });
  };

  // Download web video to local offline base64
  const handleDownloadWebVideo = async (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      alert('Please enter a video URL to download.');
      return;
    }

    setIsDownloading(true);
    setDownloadStatus('Starting download from web...');

    const result = await downloadWebMediaToOfflineBase64(cleanUrl, (msg) => {
      setDownloadStatus(msg);
    });

    setIsDownloading(false);
    setDownloadStatus('');

    if (result.success && result.dataUrl) {
      onUpdateSettings({
        ...settings,
        bgType: 'video',
        bgVideoUrl: result.dataUrl,
        bgAnimationPreset: '',
        bgImage: '',
        bgPlayState: 'playing',
        bgOpacity: settings.bgOpacity || 20,
      });
      alert('Video downloaded and saved for 100% offline playback!');
    } else {
      alert(`Could not download video: ${result.error || 'Network error'}\n\nTip: You can still apply it as a direct web stream URL.`);
    }
  };

  // Apply procedural canvas animation
  const handleSelectProcedural = (presetId: string) => {
    onUpdateSettings({
      ...settings,
      bgType: 'canvas',
      bgAnimationPreset: presetId,
      bgVideoUrl: '',
      bgImage: '',
      bgPlayState: 'playing',
      bgOpacity: settings.bgOpacity || 75,
    });
  };

  // Apply offline vector blueprint
  const handleSelectPreset = (dataUrl: string) => {
    onUpdateSettings({
      ...settings,
      bgType: 'image',
      bgImage: dataUrl,
      bgVideoUrl: '',
      bgAnimationPreset: '',
      bgOpacity: settings.bgOpacity || 22,
    });
  };

  // Remove active wallpaper
  const handleRemoveBackground = () => {
    onUpdateSettings({
      ...settings,
      bgType: 'image',
      bgImage: '',
      bgVideoUrl: '',
      bgAnimationPreset: '',
    });
  };

  // Toggle play/pause
  const togglePlayState = () => {
    const nextState = currentPlayState === 'playing' ? 'paused' : 'playing';
    onUpdateSettings({
      ...settings,
      bgPlayState: nextState,
    });
  };

  const hasActiveBackground = !!(settings.bgImage || settings.bgVideoUrl || settings.bgAnimationPreset);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div 
          className="px-6 py-4 text-white flex items-center justify-between shrink-0"
          style={{ backgroundColor: theme.primary }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Live Animation &amp; Background Wallpaper Studio
                </h2>
                {hasActiveBackground && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 uppercase tracking-wider">
                    {settings.bgType === 'video' ? 'Live Video' : settings.bgType === 'canvas' ? 'Live Animation' : 'Active'}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 font-medium">
                Add live animation loops from web, 60fps procedural animations, or offline wallpapers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('web-video')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'web-video'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>Web Video / Loops</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('procedural')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'procedural'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-600" />
            <span>Live 60fps Animations (Offline)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Upload File (Video / Photo)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>Vector Blueprints</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">

          {/* TAB 1: Web Video & Loops */}
          {activeTab === 'web-video' && (
            <div className="space-y-5">
              {/* Custom Web Video Input */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Add Live Video URL from Web
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Supports .mp4, .webm, or animated loops</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={customWebUrl}
                    onChange={(e) => setCustomWebUrl(e.target.value)}
                    placeholder="https://example.com/ambient-video-loop.mp4"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-mono"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyWebVideo(customWebUrl)}
                      className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      Apply Web Video
                    </button>
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => handleDownloadWebVideo(customWebUrl)}
                      title="Download media file so it works permanently offline without internet"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-700" />
                      <span>{isDownloading ? 'Saving...' : 'Download Offline'}</span>
                    </button>
                  </div>
                </div>

                {downloadStatus && (
                  <div className="text-xs text-blue-800 font-semibold flex items-center gap-2 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{downloadStatus}</span>
                  </div>
                )}

                {previewError && (
                  <p className="text-xs text-rose-600 font-medium">{previewError}</p>
                )}
              </div>

              {/* Curated Web Video Loops Ready to Use */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Curated Royalty-Free Live Video Backdrops
                  </h3>
                  <span className="text-[11px] text-slate-400">Click any card to stream or download</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WEB_VIDEO_PRESETS.map((vp) => {
                    const isCurrent = settings.bgType === 'video' && settings.bgVideoUrl === vp.url;
                    return (
                      <div
                        key={vp.id}
                        className={`group p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                          isCurrent
                            ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {vp.category}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <Check className="w-3 h-3" />
                              Active Live
                            </span>
                          )}
                        </div>

                        <div className="mb-3">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                            {vp.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {vp.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomWebUrl(vp.url);
                              handleApplyWebVideo(vp.url);
                            }}
                            className="flex-1 py-1.5 px-3 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Apply Stream</span>
                          </button>
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => handleDownloadWebVideo(vp.url)}
                            title="Download for permanent offline use"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200"
                          >
                            <Download className="w-3.5 h-3.5 text-blue-700" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Procedural 60fps Canvas Animations */}
          {activeTab === 'procedural' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Procedural 60fps Live Canvas Animations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zero network dependencies · 100% offline · Ultra-low GPU &amp; CPU power consumption
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROCEDURAL_ANIMATIONS.map((anim) => {
                  const isCurrent = settings.bgType === 'canvas' && (
                    settings.bgAnimationPreset === anim.id ||
                    (anim.id === 'particles' && (settings.bgAnimationPreset === 'particle-mesh' || !settings.bgAnimationPreset))
                  );
                  return (
                    <div
                      key={anim.id}
                      onClick={() => handleSelectProcedural(anim.id)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${anim.previewGradient} shadow-xs flex items-center justify-center text-white`}>
                          <Activity className="w-4 h-4 text-white/80" />
                        </div>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Check className="w-3 h-3" />
                            Live Active
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{anim.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{anim.tagline}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="capitalize">{anim.category}</span>
                        <span className="font-semibold text-blue-700">Click to Activate</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Upload Local Video / GIF / Photo */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-8 text-center cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center mx-auto mb-3 text-blue-700 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-900">
                  Click to Upload Local Video or Photo
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Supports animated <b>MP4</b>, <b>WebM</b>, <b>GIF</b> loops, or high-resolution <b>PNG / JPG</b> wallpapers (up to 14MB).
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,image/gif,image/jpeg,image/png,image/webp"
                  onChange={handleUploadFile}
                  className="hidden"
                />
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Zero Performance Impact Guarantee</p>
                  <p className="text-[11px] text-blue-800/80 mt-0.5">
                    Background videos and animations are strictly rendered on an isolated layer behind your work.
                    All quotation calculations, PDF generation, mouse clicks, and keyboard shortcuts remain 100% responsive.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Curated Vector Blueprints */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Offline Technical &amp; Atmospheric Vector Blueprints
                </h3>
                <span className="text-[11px] text-slate-400">Zero network requests · 100% offline</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {BACKGROUND_PRESETS.map((preset) => {
                  const isCurrent = settings.bgType === 'image' && settings.bgImage === preset.dataUrl;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset.dataUrl)}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className={`w-full h-16 rounded-lg bg-gradient-to-r ${preset.thumbnailGradient} mb-2 shadow-inner flex items-center justify-center text-white/40`}>
                        <ImageIcon className="w-6 h-6 opacity-60" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{preset.name}</span>
                        {isCurrent && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SHARED CONTROLS & CALIBRATION SECTION */}
          {hasActiveBackground && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Wallpaper Controls &amp; Contrast Shield
                  </span>
                </div>

                {/* Play / Pause Toggle for Animations */}
                {(settings.bgType === 'video' || settings.bgType === 'canvas') && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={togglePlayState}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      {currentPlayState === 'playing' ? (
                        <>
                          <Pause className="w-3 h-3 text-amber-600" />
                          <span>Pause Animation</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-emerald-600" />
                          <span>Resume Animation</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Opacity Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Animation / Wallpaper Opacity: {currentOpacity}%</span>
                    <span className="text-[10px] text-slate-500 font-medium">Vivid (60-90%) recommended</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={currentOpacity}
                    onChange={(e) => onUpdateSettings({ ...settings, bgOpacity: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Gaussian Blur Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Gaussian Blur: {currentBlur}px</span>
                    <span className="text-[10px] text-slate-400 font-normal">{currentBlur === 0 ? 'Sharp' : 'Ambient Soft'}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={currentBlur}
                    onChange={(e) => onUpdateSettings({ ...settings, bgBlur: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              {/* Speed Controls for Animations */}
              {(settings.bgType === 'video' || settings.bgType === 'canvas') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Animation Motion Speed
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 0.5, label: '0.5x (Gentle & Relaxed)' },
                      { val: 1.0, label: '1.0x (Normal)' },
                      { val: 1.5, label: '1.5x (Dynamic)' },
                    ].map((sp) => (
                      <button
                        key={sp.val}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, bgPlaybackSpeed: sp.val })}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          currentSpeed === sp.val
                            ? 'bg-blue-800 text-white border-blue-800 shadow-2xs font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contrast Protection Shield */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contrast Protection Shield (Protects Quotation Text Legibility)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'light', label: 'Light Shield', desc: 'Soft white wash' },
                    { id: 'dark', label: 'Dark Tint', desc: 'Cinematic contrast' },
                    { id: 'theme', label: 'Theme Hue', desc: 'Blends with theme' },
                    { id: 'none', label: 'No Shield', desc: 'Raw presentation' },
                  ].map((ov) => (
                    <button
                      key={ov.id}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, bgOverlay: ov.id as any })}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        currentOverlay === ov.id
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{ov.label}</div>
                      <div className="text-[10px] text-slate-500">{ov.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {hasActiveBackground && (
              <button
                type="button"
                onClick={handleRemoveBackground}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Wallpaper</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ring-1 ring-black/10"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
