import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ds/Icon';
import { AGENTS, PLAYS, type Agent } from '../prompts';

interface HeroProps {
  onAgent: (agent: Agent) => void;
  onCopy: () => void;
  onSkip: () => void;
}

const AgentMark: React.FC<{ agent: Agent }> = ({ agent }) => (
  <span className={`tile sm ${agent}`}><img src={AGENTS[agent].mark} alt="" /></span>
);

// "Get started" — one menu with every way in, including the one for people who already have a URL.
const GetStarted: React.FC<HeroProps> = ({ onAgent, onCopy, onSkip }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
        Get started <span className={`chev ${open ? 'up' : ''}`}><Icon name="chevron-down" size={16} /></span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label mono">build the workflow with</div>
          {(Object.keys(AGENTS) as Agent[]).map(a => (
            <button key={a} type="button" role="menuitem" className="menu-item" onClick={pick(() => onAgent(a))}>
              <AgentMark agent={a} />{AGENTS[a].name}<span className="menu-go"><Icon name="arrow-up-right" size={12} /></span>
            </button>
          ))}
          <button type="button" role="menuitem" className="menu-item" onClick={pick(onCopy)}>
            <span className="tile sm plain"><Icon name="copy" size={12} color="var(--gray-9)" /></span>Copy the prompt
          </button>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item" onClick={pick(onSkip)}>
            <span className="tile sm plain"><Icon name="webhook" size={12} color="var(--gray-9)" /></span>I already have a webhook URL
          </button>
        </div>
      )}
    </div>
  );
};

const Hero: React.FC<HeroProps> = props => (
  <>
    <section className="wrap hero">
      <div className="hero-copy">
        <div className="eyebrow mono"><span className="prompt">❯</span> bookmarklet · for reps</div>
        <h1 className="h h1">One bookmark. Any page. Into Freckle.</h1>
        <p className="lede">
          Click it in your browser bar and the page you're on becomes a row in Freckle. A workflow you built with your coding agent takes it from there.
        </p>
        <div className="hero-actions">
          <GetStarted {...props} />
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>About a minute. No code to paste.</span>
        </div>
      </div>
      <ol className="how">
        <li><span className="mono n">01</span><span>Your agent builds the workflow and hands you a webhook URL.</span></li>
        <li><span className="mono n">02</span><span>Drag <strong>Send to Freckle</strong> into your bookmarks bar.</span></li>
        <li><span className="mono n">03</span><span>Click it on any page. Add plays as you go.</span></li>
      </ol>
    </section>

    <section className="wrap plays-intro">
      <div className="section-head">
        <h2 className="h h2">What you can enrich</h2>
        <span className="eyebrow mono">{PLAYS.length} plays · one workflow routes them all</span>
      </div>
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
    </section>
  </>
);

export default Hero;
