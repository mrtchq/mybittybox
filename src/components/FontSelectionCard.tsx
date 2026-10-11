import React, { useState, useMemo, useEffect } from 'react';
import { 
  Type, 
  RotateCcw, 
  RotateCw, 
  Check, 
  Sparkles, 
  Info, 
  ChevronDown,
  Layers,
  Code
} from 'lucide-react';
import { PREDEFINED_FONTS, FontOption, applyFontToContent, detectFontFromContent } from '../utils/typography';
import { BittyMetadata } from '../types';

interface FontSelectionCardProps {
  content?: string;
  onChangeContent?: (newContent: string, immediate?: boolean) => void;
  metadata?: BittyMetadata;
  onChangeMetadata?: (newMetadata: BittyMetadata) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
}

export const FontSelectionCard: React.FC<FontSelectionCardProps> = ({
  content = '',
  onChangeContent,
  metadata,
  onChangeMetadata,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  undoCount = 0,
  redoCount = 0,
}) => {
  // Detect currently applied font from metadata or content
  const currentFontId = useMemo(() => {
    if (metadata?.fontFamily) return metadata.fontFamily;
    return detectFontFromContent(content, 'system-sans');
  }, [content, metadata?.fontFamily]);

  const [selectedFontId, setSelectedFontId] = useState<string>(currentFontId);
  const [justApplied, setJustApplied] = useState<boolean>(false);

  useEffect(() => {
    setSelectedFontId(currentFontId);
  }, [currentFontId]);

  const selectedFont = useMemo<FontOption>(() => {
    return PREDEFINED_FONTS.find(f => f.id === selectedFontId) || PREDEFINED_FONTS[0];
  }, [selectedFontId]);

  // Handle font selection change
  const handleFontSelect = (fontId: string) => {
    setSelectedFontId(fontId);
    const targetFont = PREDEFINED_FONTS.find(f => f.id === fontId) || PREDEFINED_FONTS[0];

    // Apply the font CSS to content (injects or updates <style> body rule)
    if (onChangeContent) {
      const updatedContent = applyFontToContent(content, fontId);
      onChangeContent(updatedContent, true);
    }

    // Also update metadata so fallback renderers know the chosen font
    if (onChangeMetadata && metadata) {
      onChangeMetadata({
        ...metadata,
        fontFamily: fontId,
      });
    }

    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2000);
  };

  return (
    <div 
      id="studio-tools-typography-card"
      className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#06182c]/90 via-[#0a1832]/90 to-[#0c102a]/90 border border-cyan-500/35 shadow-xl relative overflow-hidden font-mono"
    >
      {/* Subtle background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_12px_rgba(0,242,255,0.3)] shrink-0">
            <Type className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-cyber font-bold text-white tracking-wide">
                BOX TYPOGRAPHY & FONTS
              </h3>
              {justApplied && (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-full animate-in fade-in zoom-in duration-150">
                  <Check className="w-2.5 h-2.5" />
                  APPLIED
                </span>
              )}
            </div>
            <p className="text-[11px] text-cyan-300/70 mt-0.5">
              Change the typography of your Bitty Box content with web-safe and system fonts.
            </p>
          </div>
        </div>
      </div>

      {/* Font Selection Dropdown */}
      <div className="space-y-3">
        <div>
          <label 
            htmlFor="bitty-font-family-select"
            className="block text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1.5 flex items-center justify-between"
          >
            <span>SELECT FONT FAMILY</span>
            <span className="text-[10px] text-cyan-400/60 font-normal">
              {selectedFont.category} • {selectedFont.webSafe ? '100% Web-Safe' : 'System Native'}
            </span>
          </label>

          <div className="relative">
            <select
              id="bitty-font-family-select"
              value={selectedFontId}
              onChange={(e) => handleFontSelect(e.target.value)}
              className="w-full appearance-none bg-[#02010c] border-2 border-cyan-500/40 hover:border-cyan-400 focus:border-cyan-300 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer transition shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] font-sans"
            >
              <optgroup label="── Modern Sans-Serif Fonts ──" className="bg-[#030914] text-cyan-400 font-mono">
                {PREDEFINED_FONTS.filter(f => f.category === 'Sans-Serif').map(font => (
                  <option key={font.id} value={font.id} className="bg-[#030914] text-white">
                    {font.name} {font.id === currentFontId ? '✓ (Active)' : ''}
                  </option>
                ))}
              </optgroup>

              <optgroup label="── Classic Serif Fonts ──" className="bg-[#030914] text-cyan-400 font-mono">
                {PREDEFINED_FONTS.filter(f => f.category === 'Serif').map(font => (
                  <option key={font.id} value={font.id} className="bg-[#030914] text-white">
                    {font.name} {font.id === currentFontId ? '✓ (Active)' : ''}
                  </option>
                ))}
              </optgroup>

              <optgroup label="── Monospace & Code Fonts ──" className="bg-[#030914] text-cyan-400 font-mono">
                {PREDEFINED_FONTS.filter(f => f.category === 'Monospace').map(font => (
                  <option key={font.id} value={font.id} className="bg-[#030914] text-white">
                    {font.name} {font.id === currentFontId ? '✓ (Active)' : ''}
                  </option>
                ))}
              </optgroup>

              <optgroup label="── Display & Casual Fonts ──" className="bg-[#030914] text-cyan-400 font-mono">
                {PREDEFINED_FONTS.filter(f => f.category === 'Display').map(font => (
                  <option key={font.id} value={font.id} className="bg-[#030914] text-white">
                    {font.name} {font.id === currentFontId ? '✓ (Active)' : ''}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-4 h-4 text-cyan-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Live Font Sample Preview Card */}
        <div className="p-3 rounded-xl bg-[#020813] border border-cyan-500/25 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-cyan-400/60 font-mono">
            <span>LIVE TYPOGRAPHY PREVIEW</span>
            <span className="text-cyan-300 font-semibold">{selectedFont.name}</span>
          </div>
          
          <div 
            className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20 text-white text-xs leading-relaxed overflow-hidden"
            style={{ fontFamily: selectedFont.fontFamily }}
          >
            <div className="font-bold text-sm text-cyan-100 mb-1">
              Sphinx of black quartz, judge my vow.
            </div>
            <div className="text-slate-300 text-xs">
              Pack my box with five dozen liquor jugs. 0123456789 &amp; @#$%!
            </div>
          </div>

          <div className="text-[10px] text-cyan-300/70 flex items-start gap-1.5 pt-0.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>{selectedFont.description}</span>
          </div>
        </div>

        {/* Content History Controls (Undo / Redo Stack) */}
        <div className="pt-2 border-t border-cyan-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-cyan-300 tracking-wider">
              EDITOR REVISION STACK
            </span>
            <span className="text-[9px] text-cyan-400/60 font-mono">
              {undoCount} undoable {undoCount === 1 ? 'step' : 'steps'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="sidepanel-undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              className={`py-2 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                canUndo
                  ? 'bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-200 hover:text-white shadow-[0_0_12px_rgba(0,242,255,0.2)]'
                  : 'bg-[#02050c] border border-cyan-500/20 text-cyan-500/30 cursor-not-allowed'
              }`}
              title="Revert recent edit (Ctrl+Z / ⌘Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>UNDO ({undoCount})</span>
            </button>

            <button
              type="button"
              id="sidepanel-redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              className={`py-2 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                canRedo
                  ? 'bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-200 hover:text-white shadow-[0_0_12px_rgba(0,242,255,0.2)]'
                  : 'bg-[#02050c] border border-cyan-500/20 text-cyan-500/30 cursor-not-allowed'
              }`}
              title="Restore undone edit (Ctrl+Y / ⌘⇧Z)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>REDO ({redoCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
