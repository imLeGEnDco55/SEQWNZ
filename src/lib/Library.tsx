import React from 'react';
import { motion } from 'motion/react';
import { Plus, Music, ChevronRight, Trash2, Clock } from 'lucide-react';
import { Song } from './types';

interface LibraryProps {
  songs: Song[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export const Library: React.FC<LibraryProps> = ({ songs, onSelect, onAdd, onDelete }) => {
  return (
    <div className="flex-1 flex flex-col bg-[#050505] text-[#e0e0e0] font-mono overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-8 bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">My Projects</h1>
        <p className="text-[10px] text-[#444] tracking-[0.2em] uppercase">Tactile-Seq Library</p>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {songs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#222] opacity-50">
            <Music size={48} strokeWidth={1} />
            <p className="mt-4 text-[10px] tracking-widest">NO PROJECTS YET</p>
          </div>
        ) : (
          songs.map((song) => (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 flex items-center gap-4 active:bg-[#151515] transition-colors"
              onClick={() => onSelect(song.id)}
            >
              <div className="w-12 h-12 rounded-lg bg-[#8888e810] flex items-center justify-center text-[#8888e8]">
                <Music size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate text-white/90">{song.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-[9px] text-[#444]">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(song.updatedAt).toLocaleDateString()}
                  </span>
                  <span>{song.tracks.length} Tracks</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(song.id);
                  }}
                  className="p-2 text-[#222] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={20} className="text-[#222]" />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ADD BUTTON */}
      <div className="p-6 bg-gradient-to-t from-[#050505] to-transparent">
        <button 
          onClick={onAdd}
          className="w-full py-4 bg-[#8888e8] text-[#050505] rounded-2xl font-bold text-xs tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(136,136,232,0.3)] active:scale-95 transition-transform"
        >
          <Plus size={18} strokeWidth={3} />
          NEW PROJECT
        </button>
      </div>
    </div>
  );
};
