import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ds/Icon';
import { AGENTS, type Agent } from '../prompts';

interface HeroProps {
  onAgent: (agent: Agent) => void;
  onCopy: () => void;
  onSkip: () => void;
}

interface Use {
  marks: string[];
  text: string;
  out: string;
}

const USES: Use[] = [
  { marks: ['/ds/marks/linkedin.svg'], text: 'a LinkedIn profile', out: 'work email and mobile' },
  { marks: ['/ds/marks/salesforce.svg', '/ds/marks/hubspot.svg'], text: 'a CRM record', out: 'empty fields filled in' },
  { marks: ['/ds/marks/linkedin.svg'], text: 'a company LinkedIn page', out: 'find ICP contacts' },
  { marks: [], text: 'a company website', out: 'find ICP contacts' },
];

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
  <section className="wrap hero">
    <div className="hero-copy">
      <div className="eyebrow mono"><span className="prompt">❯</span> bookmarklet · for reps</div>
      <h1 className="h h1">One bookmark. Any page. Into Freckle.</h1>
      <p className="lede">
        Click it in your browser bar and the page you're on becomes a row in Freckle, where a workflow you built with your coding agent takes it from there.
      </p>
      <div className="hero-actions">
        <GetStarted {...props} />
      </div>
    </div>

    <div className="uses-card">
      <span className="eyebrow mono">what you can enrich</span>
      <ul className="uses">
        {USES.map(u => (
          <li key={u.text}>
            <span className="use-marks">
              {u.marks.length ? u.marks.map(m => <img key={m} src={m} alt="" />) : <Icon name="building" size={16} color="var(--gray-6)" />}
            </span>
            <span>Enrich <strong>{u.text}</strong></span>
            <span className="arrow"><Icon name="arrow-up-right" size={12} /></span>
            <span className="muted">{u.out}</span>
          </li>
        ))}
      </ul>
      <span className="mono subtle" style={{ fontSize: 'var(--text-2xs)' }}>one workflow routes them all · add plays in step 3</span>
    </div>
  </section>
);

export default Hero;
