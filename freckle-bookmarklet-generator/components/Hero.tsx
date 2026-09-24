import React from 'react';
import Icon from '../ds/Icon';
import { AGENTS, type Agent } from '../prompts';

interface HeroProps {
  onStart: (agent: Agent) => void;
  onSkip: () => void;
}

const USES = [
  { mark: '/ds/marks/linkedin.svg', text: 'a Sales Navigator lead', out: 'work email and mobile' },
  { mark: '/ds/marks/salesforce.svg', text: 'a Salesforce record', out: 'its empty fields filled in' },
  { mark: '/ds/marks/hubspot.svg', text: 'a HubSpot contact', out: 'enriched in place' },
  { mark: '/ds/logos/stamp_black_full.svg', text: 'a company website', out: 'the ICP people there, with contacts' },
];

const Hero: React.FC<HeroProps> = ({ onStart, onSkip }) => (
  <section className="wrap hero">
    <div className="hero-copy">
      <div className="eyebrow mono"><span className="prompt">❯</span> bookmarklet · for reps</div>
      <h1 className="h h1">One bookmark. Any page. Into Freckle.</h1>
      <p className="lede">
        Click it in your browser bar and the page you're on becomes a row in Freckle, where a workflow you built with your coding agent takes it from there.
      </p>
      <ul className="uses">
        {USES.map(u => (
          <li key={u.text}>
            <img src={u.mark} alt="" />
            <span>Send <strong>{u.text}</strong></span>
            <span className="arrow"><Icon name="arrow-up-right" size={12} /></span>
            <span className="muted">{u.out}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="start">
      <div className="start-head">
        <span className="eyebrow mono">start here</span>
        <h2 className="h h3">Build the workflow with your coding agent</h2>
        <p className="step-help">One click copies a setup prompt. Paste it into a new session, and it builds the webhook and hands you the URL.</p>
      </div>
      <div className="agents">
        {(Object.keys(AGENTS) as Agent[]).map(a => (
          <button key={a} type="button" className="agent" onClick={() => onStart(a)}>
            <span className={`tile ${a}`}><img src={AGENTS[a].mark} alt="" /></span>
            <span className="agent-name">{AGENTS[a].name}</span>
            <span className="agent-sub mono">copy prompt</span>
          </button>
        ))}
      </div>
      <div className="start-foot">
        <span className="mono subtle">needs the Freckle CLI · npx freckle login</span>
        <button type="button" className="linkbtn" onClick={onSkip}>Already have a webhook URL?</button>
      </div>
    </div>
  </section>
);

export default Hero;
