import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Volume2, 
  Settings2, 
  Lock,
  Unlock,
  ArrowLeft,
  Grid3X3,
  Undo2,
  Redo2,
  Download,
  Mic,
  Music,
  Drum,
  Guitar,
  Keyboard,
  Speaker,
  Headphones
} from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import { Track, Block, Section } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────
const LABEL_W = 120; 
const TRACK_H = 64;  
const RULER_H = 32;

const ICONS = ['mic', 'music', 'drum', 'guitar', 'keyboard', 'speaker', 'headphones'];

const IconRenderer = ({ name, size = 16, className = "" }: { name: string, size?: number, className?: string }) => {
  switch (name) {
    case 'mic': return <Mic size={size} className={className} />;
    case 'music': return <Music size={size} className={className} />;
    case 'drum': return <Drum size={size} className={className} />;
    case 'guitar': return <Guitar size={size} className={className} />;
    case 'keyboard': return <Keyboard size={size} className={className} />;
    case 'speaker': return <Speaker size={size} className={className} />;
    case 'headphones': return <Headphones size={size} className={className} />;
    default: return <Mic size={size} className={className} />;
  }
};
const SECTION_H = 24;
const BASE_BAR_W = 48;
const TOTAL_BARS = 64;

interface ArrangerProps {
  title: string;
  tracks: Track[];
  sections: Section[];
  onUpdateTracks: (tracks: Track[]) => void;
  onUpdateSections: (sections: Section[]) => void;
  playhead: number;
  setPlayhead: (ph: number) => void;
  renderBlock?: (block: Block, track: Track) => React.ReactNode;
  onBack: () => void;
}

const PALETTE = ['#FF4D6D', '#74C0FC', '#69DB7C', '#FFD43B', '#9775FA', '#FF922B', '#63E6BE', '#4DABF7'];

export const Arranger: React.FC<ArrangerProps> = ({
  title,
  tracks,
  sections,
  onUpdateTracks,
  onUpdateSections,
  playhead,
  setPlayhead,
  renderBlock,
  onBack
}) => {
  const [zoom, setZoom] = useState(1.0);
  const [isLocked, setIsLocked] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<{tid: string, bid: string} | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ── History Management ─────────────────────────────────────────────────────
  const [history, setHistory] = useState<{tracks: Track[], sections: Section[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ tracks, sections }]);
      setHistoryIndex(0);
    }
  }, []);

  const [isExporting, setIsExporting] = useState(false);
  const sequencerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    try {
      // Small delay to ensure the hidden DOM is fully layouted and fonts are ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const width = exportRef.current.scrollWidth;
      const height = exportRef.current.scrollHeight;

      const dataUrl = await domToPng(exportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        width,
        height,
        // Force visibility during capture clone
        style: {
          left: '0',
          top: '0',
          opacity: '1',
          visibility: 'visible',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter, sans-serif'
        }
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-sheet.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const pushHistory = (newTracks: Track[], newSections: Section[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ tracks: JSON.parse(JSON.stringify(newTracks)), sections: JSON.parse(JSON.stringify(newSections)) });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      onUpdateTracks(prev.tracks);
      onUpdateSections(prev.sections);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      onUpdateTracks(next.tracks);
      onUpdateSections(next.sections);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const pinchRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  const longPressTimer = useRef<any>(null);

  const barW = BASE_BAR_W * zoom;
  const totalW = TOTAL_BARS * barW;

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: 'move' | 'resize' | 'section-move' | 'section-resize';
    tid?: string;
    bid?: string;
    sid?: string;
    startX: number;
    initialStart: number;
    initialLength: number;
  } | null>(null);

  // ── Unified Pointer Handling ───────────────────────────────────────────────
  const handlePointerDown = (
    e: React.PointerEvent, 
    kind: any, 
    payload: any
  ) => {
    if (isLocked && kind !== 'playhead') return;
    e.stopPropagation();
    
    // Set capture on the CONTAINER for smooth dragging
    scrollRef.current?.setPointerCapture(e.pointerId);

    dragRef.current = {
      kind,
      ...payload,
      startX: e.clientX,
    };

    if (payload.tid && payload.bid) {
      setSelectedBlock({ tid: payload.tid, bid: payload.bid });
      
      // Start long press timer for deletion
      if (kind === 'move') {
        longPressTimer.current = setTimeout(() => {
          deleteBlock(payload.tid, payload.bid);
          if (navigator.vibrate) navigator.vibrate(50);
          dragRef.current = null; // Cancel drag if deleted
        }, 800);
      }
    } else {
      setSelectedBlock(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;

    // If moving, cancel long press
    if (Math.abs(e.clientX - d.startX) > 5) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    const deltaX = e.clientX - d.startX;
    const deltaBars = deltaX / barW;

    if (d.kind === 'move' && d.tid && d.bid) {
      const newStart = d.initialStart + deltaBars;
      let finalStart = snapToGrid ? Math.max(0, Math.round(newStart)) : Math.max(0, newStart);
      
      // Collision Detection
      const track = tracks.find(t => t.id === d.tid);
      if (track) {
        const otherBlocks = track.blocks.filter(b => b.id !== d.bid);
        const len = d.initialLength;
        
        if (deltaX > 0) {
          // Moving Right
          const blocksToRight = otherBlocks.filter(ob => ob.start >= d.initialStart + d.initialLength - 0.01)
                                          .sort((a, b) => a.start - b.start);
          for (const ob of blocksToRight) {
            if (finalStart + len > ob.start) {
              finalStart = ob.start - len;
              break;
            }
          }
        } else {
          // Moving Left
          const blocksToLeft = otherBlocks.filter(ob => ob.start + ob.length <= d.initialStart + 0.01)
                                         .sort((a, b) => b.start - a.start);
          for (const ob of blocksToLeft) {
            const obEnd = ob.start + ob.length;
            if (finalStart < obEnd) {
              finalStart = obEnd;
              break;
            }
          }
        }
      }

      const newTracks = tracks.map(t => t.id !== d.tid ? t : {
        ...t,
        blocks: t.blocks.map(b => b.id !== d.bid ? b : {
          ...b,
          start: finalStart
        })
      });
      onUpdateTracks(newTracks);
    } else if (d.kind === 'resize' && d.tid && d.bid) {
      const newLength = d.initialLength + deltaBars;
      let finalLength = snapToGrid ? Math.max(1, Math.round(newLength)) : Math.max(0.1, newLength);

      // Collision Detection for Resize
      const track = tracks.find(t => t.id === d.tid);
      if (track) {
        const otherBlocks = track.blocks.filter(b => b.id !== d.bid);
        const start = d.initialStart;
        const blocksToRight = otherBlocks.filter(ob => ob.start >= start + d.initialLength - 0.01)
                                        .sort((a, b) => a.start - b.start);
        
        for (const ob of blocksToRight) {
          if (start + finalLength > ob.start) {
            finalLength = ob.start - start;
            break;
          }
        }
      }

      const newTracks = tracks.map(t => t.id !== d.tid ? t : {
        ...t,
        blocks: t.blocks.map(b => b.id !== d.bid ? b : {
          ...b,
          length: finalLength
        })
      });
      onUpdateTracks(newTracks);
    } else if (d.kind === 'section-move' && d.sid) {
      const newSections = sections.map(s => s.id !== d.sid ? s : {
        ...s,
        start: Math.max(0, Math.round(d.initialStart + deltaBars))
      });
      onUpdateSections(newSections);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragRef.current) {
      scrollRef.current?.releasePointerCapture(e.pointerId);
      pushHistory(tracks, sections);
      dragRef.current = null;
    }
  };

  // ── Pinch to Zoom Handling ────────────────────────────────────────────────
  const getTouchDist = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches);
      pinchRef.current = { initialDist: dist, initialZoom: zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = getTouchDist(e.touches);
      const scale = dist / pinchRef.current.initialDist;
      const newZoom = Math.max(0.5, Math.min(4, pinchRef.current.initialZoom * scale));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const addBlock = (tid: string, start: number) => {
    const track = tracks.find(t => t.id === tid);
    if (!track) return;
    
    let finalStart = Math.floor(start);
    const length = 4;
    
    // Check if space is occupied and find next available slot
    const sortedBlocks = [...track.blocks].sort((a, b) => a.start - b.start);
    for (const b of sortedBlocks) {
      const bEnd = b.start + b.length;
      // If our new block would overlap this one
      if (finalStart < bEnd && finalStart + length > b.start) {
        finalStart = bEnd;
      }
    }

    const newTracks = tracks.map(t => t.id !== tid ? t : {
      ...t,
      blocks: [...t.blocks, { 
        id: Math.random().toString(36).substr(2, 9), 
        start: finalStart, 
        length: length,
        color: t.color,
        label: track.name
      }]
    });
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
  };

  const deleteBlock = (tid: string, bid: string) => {
    const newTracks = tracks.map(t => t.id !== tid ? t : {
      ...t,
      blocks: t.blocks.filter(b => b.id !== bid)
    });
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
    setSelectedBlock(null);
  };

  const addTrack = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newTrack: Track = {
      id,
      name: `Track ${tracks.length + 1}`,
      color: PALETTE[tracks.length % PALETTE.length],
      blocks: []
    };
    const newTracks = [...tracks, newTrack];
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
    setEditingTrackId(id);
    setEditValue(newTrack.name);
  };

  const deleteTrack = (tid: string) => {
    const newTracks = tracks.filter(t => t.id !== tid);
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
  };

  const addSection = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const lastSection = sections[sections.length - 1];
    const start = lastSection ? lastSection.start + lastSection.length : 0;
    const newSection: Section = {
      id,
      start,
      length: 8,
      label: 'NEW'
    };
    const newSections = [...sections, newSection];
    onUpdateSections(newSections);
    pushHistory(tracks, newSections);
    setEditingSectionId(id);
    setEditValue(newSection.label);
  };

  const deleteSection = (sid: string) => {
    const newSections = sections.filter(s => s.id !== sid);
    onUpdateSections(newSections);
    pushHistory(tracks, newSections);
  };

  const handleRenameTrack = (tid: string) => {
    const newTracks = tracks.map(t => t.id === tid ? { ...t, name: editValue || t.name } : t);
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
    setEditingTrackId(null);
  };

  const handleRenameSection = (sid: string) => {
    const newSections = sections.map(s => s.id === sid ? { ...s, label: editValue.toUpperCase() || s.label } : s);
    onUpdateSections(newSections);
    pushHistory(tracks, newSections);
    setEditingSectionId(null);
  };

  const cycleTrackColor = (tid: string) => {
    const track = tracks.find(t => t.id === tid);
    if (!track) return;
    const currentIndex = PALETTE.indexOf(track.color);
    const nextColor = PALETTE[(currentIndex + 1) % PALETTE.length];
    const newTracks = tracks.map(t => t.id === tid ? { ...t, color: nextColor } : t);
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
  };

  const cycleTrackIcon = (tid: string) => {
    const track = tracks.find(t => t.id === tid);
    if (!track) return;
    const currentIcon = track.icon || 'mic';
    const currentIndex = ICONS.indexOf(currentIcon);
    const nextIcon = ICONS[(currentIndex + 1) % ICONS.length];
    const newTracks = tracks.map(t => t.id === tid ? { ...t, icon: nextIcon } : t);
    onUpdateTracks(newTracks);
    pushHistory(newTracks, sections);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-[#e0e0e0] font-mono select-none overflow-hidden">
      
      {/* ── Hidden Export View (Music Sheet Style) ─────────────────────────── */}
      <div 
        ref={exportRef}
        className="fixed top-0 left-[-9999px] bg-white text-black p-12 flex flex-col gap-8 pointer-events-none font-sans opacity-0 invisible"
        style={{ 
          width: totalW + LABEL_W + 100,
          height: tracks.length * TRACK_H + 400,
          zIndex: -100
        }}
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold uppercase tracking-widest border-b-4 border-black pb-4">{title}</h1>
          <div className="flex justify-between text-sm font-bold uppercase tracking-tighter opacity-60">
            <span>Arrangement Sheet</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="relative border-2 border-black">
          {/* Ruler / Measures */}
          <div className="flex border-b-2 border-black bg-gray-50" style={{ height: RULER_H }}>
            <div style={{ width: LABEL_W }} className="border-r-2 border-black" />
            <div className="relative flex-1">
              {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute top-0 bottom-0 border-r border-gray-300 flex items-end pb-1 pl-1 text-[10px] font-bold"
                  style={{ left: i * barW, width: barW }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Tracks */}
          {tracks.map((track) => (
            <div key={track.id} className="flex border-b border-gray-200" style={{ height: TRACK_H }}>
              <div 
                style={{ width: LABEL_W }} 
                className="border-r-2 border-black flex items-center px-3 gap-2 bg-gray-50"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <IconRenderer name={track.icon || 'mic'} size={14} />
                </div>
                <span className="text-xs font-bold truncate uppercase">{track.name}</span>
              </div>
              <div className="relative flex-1 bg-white">
                {/* Grid lines */}
                {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute top-0 bottom-0 border-r border-gray-100"
                    style={{ left: i * barW }}
                  />
                ))}
                {/* Blocks */}
                {track.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="absolute top-1 bottom-1 rounded-sm border border-black/20 shadow-sm flex items-center justify-center overflow-hidden"
                    style={{
                      left: block.start * barW + 2,
                      width: block.length * barW - 4,
                      backgroundColor: track.color,
                    }}
                  >
                    <span className="text-[9px] font-bold uppercase text-black/60 truncate px-1">
                      {block.label || track.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Sections Overlay */}
          <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: RULER_H }}>
            <div style={{ width: LABEL_W }} />
            <div className="relative flex-1 h-full">
              {sections.map(sec => (
                <div 
                  key={sec.id}
                  className="absolute top-0 h-full border-x-2 border-black bg-black/5 flex items-center justify-center"
                  style={{ left: sec.start * barW, width: sec.length * barW }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white px-2 border border-black">
                    {sec.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end mt-4">
          <div className="text-[10px] font-bold opacity-40">
            Generated via Sequencer Studio • {TOTAL_BARS} Bars • {tracks.length} Tracks
          </div>
          <div className="flex gap-4">
            {PALETTE.map(c => (
              <div key={c} className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-[#1a1a1a] z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-[#444] hover:text-white transition-colors active:scale-90"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[12px] font-bold tracking-[0.2em] text-[#8888e8] uppercase">{title}</h1>
        </div>

        <button 
          onClick={handleExport}
          disabled={isExporting}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all active:scale-95 ${isExporting ? 'bg-[#222] border-[#333] text-[#444]' : 'bg-[#8888e810] border-[#8888e840] text-[#8888e8] hover:bg-[#8888e820]'}`}
        >
          <Download size={14} />
          {isExporting ? 'Exporting...' : 'Export Image'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden" ref={sequencerRef}>
        
        {/* TRACK LABELS */}
        <div className="w-[120px] bg-[#080808] border-r border-[#1a1a1a] z-40 flex flex-col">
          <div className="h-[56px] border-b border-[#1a1a1a] flex items-end p-2">
            <span className="text-[8px] text-[#444] tracking-widest uppercase">Tracks</span>
          </div>
          {tracks.map(track => (
            <div 
              key={track.id} 
              className={`h-[64px] border-b border-[#111] flex items-center px-2 gap-2 transition-colors relative ${activeTrackId === track.id ? 'bg-[#111]' : ''}`}
              onClick={() => setActiveTrackId(track.id)}
            >
              <div 
                className="w-1.5 h-8 rounded-full shadow-lg cursor-pointer" 
                style={{ backgroundColor: track.color, boxShadow: `0 0 10px ${track.color}40` }} 
                onClick={(e) => { e.stopPropagation(); cycleTrackColor(track.id); }}
              />
              <div 
                className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#222] flex items-center justify-center text-[#444] hover:text-[#8888e8] cursor-pointer active:scale-90 transition-all"
                onClick={(e) => { e.stopPropagation(); cycleTrackIcon(track.id); }}
              >
                <IconRenderer name={track.icon || 'mic'} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                {editingTrackId === track.id ? (
                  <input 
                    autoFocus
                    className="w-full bg-[#1a1a1a] text-[10px] text-white outline-none border-b border-[#8888e8]"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleRenameTrack(track.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameTrack(track.id)}
                  />
                ) : (
                  <div 
                    className="text-[10px] truncate font-medium"
                    onDoubleClick={() => { setEditingTrackId(track.id); setEditValue(track.name); }}
                  >{track.name}</div>
                )}
                <div className="flex gap-2 mt-1">
                  <button className="text-[#444] hover:text-[#8888e8]"><Volume2 size={12} /></button>
                  <button 
                    className="text-[#444] hover:text-[#ef4444]"
                    onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                  ><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
          <button 
            onClick={addTrack}
            className="p-4 flex justify-center text-[#333] hover:text-[#8888e8] transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* TIMELINE AREA */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-auto relative bg-[#050505]"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setSelectedBlock(null)}
        >
          <div 
            style={{ width: totalW, minHeight: '100%' }} 
            className="relative"
          >
            
            {/* RULER & SECTIONS */}
            <div className="sticky top-0 z-30 bg-[#050505]">
              {/* Ruler */}
              <div 
                className="h-[32px] relative border-b border-[#1a1a1a]"
              >
                {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute top-0 h-full border-l border-[#111]"
                    style={{ left: i * barW }}
                  >
                    {i % 4 === 0 && (
                      <span className="text-[8px] text-[#333] ml-1 mt-1 block">{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>
              {/* Sections (Now Below Ruler) */}
              <div className="h-[24px] relative border-b border-[#1a1a1a] flex items-center">
                {sections.map((sec, i) => (
                  <div 
                    key={sec.id}
                    className="absolute top-0 h-full border-l border-[#333] flex items-center px-2 overflow-hidden group/sec"
                    style={{ 
                      left: sec.start * barW, 
                      width: sec.length * barW,
                      backgroundColor: `rgba(136, 136, 232, ${0.05 + (i % 2) * 0.05})`
                    }}
                    onPointerDown={(e) => handlePointerDown(e, 'section-move', { sid: sec.id, initialStart: sec.start })}
                    onDoubleClick={() => { setEditingSectionId(sec.id); setEditValue(sec.label); }}
                  >
                    {editingSectionId === sec.id ? (
                      <input 
                        autoFocus
                        className="w-full bg-transparent text-[7px] text-white outline-none uppercase"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleRenameSection(sec.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSection(sec.id)}
                      />
                    ) : (
                      <span className="text-[7px] text-[#666] uppercase tracking-tighter whitespace-nowrap">{sec.label}</span>
                    )}
                    
                    <button 
                      className="absolute right-1 opacity-0 group-hover/sec:opacity-100 text-[#444] hover:text-[#ef4444]"
                      onClick={(e) => { e.stopPropagation(); deleteSection(sec.id); }}
                    >
                      <Plus size={8} className="rotate-45" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* TRACK ROWS */}
            {tracks.map(track => (
              <div 
                key={track.id} 
                className="h-[64px] border-b border-[#0a0a0a] relative group"
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  addBlock(track.id, x / barW);
                }}
              >
                {/* Grid */}
                {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`absolute top-0 h-full ${i % 4 === 0 ? 'border-l border-[#111]' : 'border-l border-[#080808]'}`}
                    style={{ left: i * barW }}
                  />
                ))}

                {/* Blocks */}
                <AnimatePresence>
                  {track.blocks.map(block => {
                    const isSelected = selectedBlock?.tid === track.id && selectedBlock?.bid === block.id;
                    return (
                      <motion.div
                        key={block.id}
                        layoutId={block.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`absolute top-2 bottom-2 rounded-md border flex items-center justify-between overflow-visible group/block ${isSelected ? 'z-50' : 'z-10'}`}
                        style={{ 
                          left: block.start * barW + 2, 
                          width: block.length * barW - 4,
                          backgroundColor: isSelected ? `${track.color}30` : `${track.color}15`,
                          borderColor: isSelected ? track.color : `${track.color}40`,
                          boxShadow: isSelected ? `0 0 20px ${track.color}40` : `inset 0 0 20px ${track.color}05`
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'move', { tid: track.id, bid: block.id, initialStart: block.start, initialLength: block.length })}
                      >
                        {/* Drag Handle (Visual) */}
                        <div className="w-1 h-full bg-white/5" />
                        
                        <div className="flex-1 px-2 pointer-events-none h-full flex items-center">
                          {renderBlock ? renderBlock(block, track) : (
                            <div className="text-[9px] font-bold text-white/60 truncate uppercase tracking-tighter">
                              {track.name}
                            </div>
                          )}
                        </div>

                        {/* Resize Handle (Mobile Optimized - Larger) */}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-10 cursor-col-resize flex items-center justify-center bg-white/10 active:bg-white/30 z-20"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handlePointerDown(e, 'resize', { tid: track.id, bid: block.id, initialLength: block.length });
                          }}
                        >
                          <div className="w-[3px] h-8 bg-white/60 rounded-full shadow-sm" />
                        </div>

                        {/* Long Press Indicator */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-white/5 pointer-events-none animate-pulse" />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}

            {/* PLAYHEAD REMOVED */}

          </div>
        </div>
      </div>

      {/* FOOTER / TOOLS */}
      <div className="h-16 bg-[#0a0a0a] border-t border-[#1a1a1a] flex items-center px-4 justify-between z-50">
        <div className="flex items-center gap-2">
          {/* Tool Buttons - Unified Style */}
          <button 
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-90 ${historyIndex > 0 ? 'bg-[#1a1a1a] text-[#8888e8] border border-[#8888e840]' : 'bg-[#080808] text-[#222] border border-[#111]'}`}
          >
            <Undo2 size={18} />
          </button>
          <button 
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-90 ${historyIndex < history.length - 1 ? 'bg-[#1a1a1a] text-[#8888e8] border border-[#8888e840]' : 'bg-[#080808] text-[#222] border border-[#111]'}`}
          >
            <Redo2 size={18} />
          </button>
          
          <div className="w-[1px] h-6 bg-[#222] mx-1" />

          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${isLocked ? 'bg-[#8888e820] text-[#8888e8] border-[#8888e840]' : 'bg-[#1a1a1a] text-[#444] border-[#222]'}`}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>
          <button 
            onClick={addSection}
            className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#8888e8] flex items-center justify-center active:scale-90 transition-all"
          >
            <Plus size={18} />
          </button>
          <button 
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${snapToGrid ? 'bg-[#8888e820] text-[#8888e8] border-[#8888e840]' : 'bg-[#1a1a1a] text-[#444] border-[#222]'}`}
          >
            <Grid3X3 size={18} />
          </button>
        </div>

        <div className="flex flex-col items-end gap-1 text-[8px] text-[#444] tracking-widest uppercase font-bold">
          <span>Last Bar: {Math.max(0, ...tracks.flatMap(t => t.blocks.map(b => Math.ceil(b.start + b.length))))}</span>
          <span>Zoom: {zoom.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
};
