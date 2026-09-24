import React from 'react';
import Icon from '../ds/Icon';

interface HeroProps {
  onStart: () => void;
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
      <div className="hero-actions">
        <button type="button" className="btn btn-primary" onClick={onStart}>Set it up <Icon name="arrow-up-right" size={12} /></button>
        <button type="button" className="linkbtn" onClick={onSkip}>Already have a webhook URL?</button>
      </div>
    </div>

    <div className="uses-card">
      <span className="eyebrow mono">what you can send</span>
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
      <span className="mono subtle" style={{ fontSize: 'var(--text-2xs)' }}>one workflow routes them all · add plays in step 3</span>
    </div>
  </section>
);

export default Hero;
