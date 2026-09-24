import React, { useState } from 'react';
import Icon from '../ds/Icon';

interface HeroProps {
  onStart: () => void;
}

// Right column is the demo slot: a mock browser inside the site's showcase panel.
// Drop the recording at public/drag-demo.gif and it replaces the placeholder automatically.
const GifSlot: React.FC = () => {
  const [hasGif, setHasGif] = useState(true);
  return (
    <div className="showcase-card">
      <div className="chrome-bar">
        <div className="chrome-dots"><span /><span /><span /></div>
        <div className="chrome-url">linkedin.com/sales/lead/ACwAABWPEl0…</div>
      </div>
      <div className="chrome-bookmarks">
        <span className="bm-ghost w2" />
        <span className="bm-ghost" />
        <span className="bm-chip hot"><img src="/ds/logos/stamp_black_full.svg" alt="" />Send to Freckle</span>
        <span className="bm-ghost w3" />
      </div>
      <div className="gif-slot">
        {hasGif ? (
          <img src="/drag-demo.gif" alt="Dragging the Send to Freckle button into the bookmarks bar, then clicking it on a LinkedIn page" onError={() => setHasGif(false)} />
        ) : (
          <span className="label">drag-demo.gif · coming soon</span>
        )}
      </div>
    </div>
  );
};

const Hero: React.FC<HeroProps> = ({ onStart }) => (
  <section className="wrap hero">
    <div className="hero-copy">
      <div className="eyebrow mono"><span className="prompt">❯</span> bookmarklet · for reps</div>
      <h1 className="h h1">Send any page to Freckle in one click</h1>
      <p className="lede">
        A bookmark that lives in your browser bar. Click it on a LinkedIn profile, a Sales Navigator lead, a HubSpot record or a company site, and the URL lands in your Freckle table, ready to enrich.
      </p>
      <div className="hero-actions">
        <button className="btn btn-primary" onClick={onStart}>
          <Icon name="webhook" size={16} /> Set it up
        </button>
        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>Two steps. No code to paste.</span>
      </div>
      <div className="term" aria-label="Example">
        <div className="term-line"><span className="p">❯</span><span>Send to Freckle</span></div>
        <div className="term-line subtle"><span style={{ width: 8 }} /><span>linkedin.com/in/emilygruzdowich</span></div>
        <div className="term-line"><span className="ok">✓</span><span>1 row added to <span style={{ color: 'var(--gray-9)' }}>Inbound leads</span></span></div>
        <div className="term-line"><span className="p">❯</span><span className="cursor" /></div>
      </div>
    </div>
    <div className="showcase">
      <div className="showcase-panel">
        <GifSlot />
        <div className="showcase-caption"><span className="p">❯ </span>Drag it once. Click it on any page.</div>
      </div>
    </div>
  </section>
);

export default Hero;
