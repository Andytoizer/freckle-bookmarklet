import React from 'react';
import { PLAYS } from '../prompts';

// The compact play cards: logos, title, what you send and what you get. No prompt.
const PlayGrid: React.FC = () => (
  <div className="play-grid">
    {PLAYS.map(p => (
      <div key={p.id} className="play-card">
        <span className="play-marks">{p.marks.map(m => <span key={m} className="play-mark"><img src={m} alt="" /></span>)}</span>
        <span className="play-card-title">{p.title}</span>
        <span className="play-card-io"><span className="k">send</span>{p.send}</span>
        <span className="play-card-io"><span className="k">get</span>{p.get}</span>
      </div>
    ))}
  </div>
);

export default PlayGrid;
