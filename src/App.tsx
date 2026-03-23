/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Arranger } from './lib/Arranger';
import { Library } from './lib/Library';
import { Track, Section, Block, Song } from './lib/types';
import { Activity, Music, Mic2, Waves } from 'lucide-react';

const STORAGE_KEY = 'tactile_seq_library';

const DEFAULT_TRACKS: Track[] = [
  { id: 't1', name: 'Drums', color: '#FF4D6D', blocks: [] },
  { id: 't2', name: 'Bass', color: '#74C0FC', blocks: [] },
  { id: 't3', name: 'Synth', color: '#69DB7C', blocks: [] },
  { id: 't4', name: 'Vocals', color: '#FFD43B', blocks: [] }
];

const DEFAULT_SECTIONS: Section[] = [
  { id: 's1', start: 0, length: 8, label: 'Intro' },
  { id: 's2', start: 8, length: 16, label: 'Verse' }
];

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSongs(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse library', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (songs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    }
  }, [songs]);

  const currentSong = songs.find(s => s.id === currentSongId);

  const handleCreateProject = () => {
    const title = newProjectTitle.trim() || `New Song ${songs.length + 1}`;
    
    const newSong: Song = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      updatedAt: Date.now(),
      tracks: JSON.parse(JSON.stringify(DEFAULT_TRACKS)),
      sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
      playhead: 0
    };

    setSongs([newSong, ...songs]);
    setCurrentSongId(newSong.id);
    setIsNewProjectModalOpen(false);
    setNewProjectTitle('');
  };

  const deleteSong = (id: string) => {
    setSongs(songs.filter(s => s.id !== id));
    if (currentSongId === id) setCurrentSongId(null);
  };

  const updateCurrentSong = (updates: Partial<Song>) => {
    if (!currentSongId) return;
    setSongs(songs.map(s => s.id === currentSongId ? { ...s, ...updates, updatedAt: Date.now() } : s));
  };

  const customBlockRenderer = (block: Block, track: Track) => {
    const Icon = block.data?.icon === 'beat' ? Activity : 
                 block.data?.icon === 'wave' ? Waves :
                 block.data?.icon === 'music' ? Music : Mic2;

    return (
      <div className="flex items-center gap-2 w-full">
        <Icon size={12} style={{ color: track.color }} />
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold text-white/80 truncate uppercase tracking-tighter">
            {block.label || 'Clip'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-[#050505]">
      {/* MODAL PARA NUEVO PROYECTO */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">New Project</h2>
            <input 
              autoFocus
              type="text"
              placeholder="Project Title"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              className="w-full bg-[#151515] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#8888e8] transition-colors mb-6"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setIsNewProjectModalOpen(false)}
                className="flex-1 py-3 bg-[#1a1a1a] text-[#444] rounded-xl font-bold text-[10px] tracking-widest uppercase hover:text-white transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={handleCreateProject}
                className="flex-1 py-3 bg-[#8888e8] text-[#050505] rounded-xl font-bold text-[10px] tracking-widest uppercase shadow-[0_0_20px_rgba(136,136,232,0.2)]"
              >
                CREATE
              </button>
            </div>
          </div>
        </div>
      )}

      {currentSong ? (
        <Arranger 
          title={currentSong.title}
          tracks={currentSong.tracks}
          sections={currentSong.sections}
          onUpdateTracks={(tracks) => updateCurrentSong({ tracks })}
          onUpdateSections={(sections) => updateCurrentSong({ sections })}
          playhead={currentSong.playhead}
          setPlayhead={(playhead) => updateCurrentSong({ playhead })}
          renderBlock={customBlockRenderer}
          onBack={() => setCurrentSongId(null)}
        />
      ) : (
        <Library 
          songs={songs}
          onSelect={setCurrentSongId}
          onAdd={() => setIsNewProjectModalOpen(true)}
          onDelete={deleteSong}
        />
      )}
    </div>
  );
}
