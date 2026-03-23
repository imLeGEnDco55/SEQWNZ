export interface Block {
  id: string;
  start: number;
  length: number;
  label?: string;
  color?: string;
  data?: any;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  icon?: string;
  muted?: boolean;
  blocks: Block[];
}

export interface Section {
  id: string;
  start: number;
  length: number;
  label: string;
}

export interface Song {
  id: string;
  title: string;
  updatedAt: number;
  tracks: Track[];
  sections: Section[];
  playhead: number;
}
