import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Icon from '../ds/Icon';
import { buildBookmarklet, normalizeWebhook } from '../bookmarklet';
import { AGENTS, PLAYS, SETUP_PROMPT, type Agent } from '../prompts';

const WEBHOOK_RE = /^https:\/\/next-api\.freckle\.io\/v2\/dataset-webhooks\/[^/\s]+\/[^/\s]+$/i;

type Check = { state: 'idle' | 'ok' | 'bad'; fixed: boolean };

const check = (raw: string): Check => {
  const trimmed = raw.trim();
  if (!trimmed) return { state: 'idle', fixed: false };
  const normalized = normalizeWebhook(trimmed);
  return { state: WEBHOOK_RE.test(normalized) ? 'ok' : 'bad', fixed: normalized !== trimmed };
};

export interface BuilderHandle {
  start: (agent: Agent) => void;
  skipToPaste: () => void;
}

const useCopy = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2500);
    });
  };
  return { copied, copy };
};

// Demo slot for step 2. Drop the recording at public/drag-demo.gif and it replaces the placeholder.
const DragDemo: React.FC = () => {
  const [hasGif, setHasGif] = useState(true);
  return (
    <div className="demo">
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
          <img src="/drag-demo.gif" alt="Dragging the Send to Freckle chip into the bookmarks bar" onError={() => setHasGif(false)} />
        ) : (
          <span className="label">how-to gif · coming soon</span>
        )}
      </div>
    </div>
  );
};

interface StepProps {
  n: string;
  status: 'open' | 'done' | 'todo';
  title: string;
  summary?: React.ReactNode;
  onOpen: () => void;
  children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ n, status, title, summary, onOpen, children }) => (
  <div className={`step ${status}`}>
    <div className="step-num">
      <span className="n">{status === 'done' ? <Icon name="check" size={12} /> : n}</span>
      <span className="line" />
    </div>
    <div className="step-body">
      <button type="button" className="step-head" onClick={onOpen} aria-expanded={status === 'open'}>
        <h3 className="step-title">{title}</h3>
        {status !== 'open' && summary && <span className="step-summary mono">{summary}</span>}
        {status !== 'open' && <span className="chev"><Icon name="chevron-down" size={16} /></span>}
      </button>
      {status === 'open' && <div className="step-content">{children}</div>}
    </div>
  </div>
);

const Builder = forwardRef<BuilderHandle, {}>((_, ref) => {
  const [raw, setRaw] = useState('');
  const [agent, setAgent] = useState<Agent | null>(null);
  const [open, setOpen] = useState<1 | 2 | 3>(1);
  const [dragged, setDragged] = useState(false);
  const [nudge, setNudge] = useState(false);
  const { copied, copy } = useCopy();
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLAnchorElement>(null);

  const result = useMemo(() => check(raw), [raw]);
  const ready = result.state === 'ok';
  const webhook = ready ? normalizeWebhook(raw) : '';
  const code = useMemo(() => (ready ? buildBookmarklet(raw) : ''), [ready, raw]);

  // React refuses javascript: URLs in href, so the bookmarklet is set on the DOM node directly.
  useEffect(() => {
    chipRef.current?.setAttribute('href', code || '#');
  }, [code, open]);

  // Advance as soon as the webhook is valid; the paste box is the last thing in step 1.
  useEffect(() => {
    if (ready && open === 1) setOpen(2);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollHere = () => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useImperativeHandle(ref, () => ({
    start: a => {
      setAgent(a);
      copy('setup-' + a, SETUP_PROMPT);
      setOpen(1);
      scrollHere();
    },
    skipToPaste: () => {
      setOpen(1);
      scrollHere();
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 400);
    },
  }));

  const short = webhook.replace('https://next-api.freckle.io/v2/dataset-webhooks/', '…/').replace(/\/[^/]+$/, '/…');

  return (
    <section className="section" ref={sectionRef} id="setup">
      <div className="wrap">
        <div className="section-head">
          <h2 className="h h2">Set it up</h2>
          <span className="eyebrow mono">three steps</span>
        </div>

        <div className="steps">
          <Step n="01" status={open === 1 ? 'open' : ready ? 'done' : 'todo'} title="Get your webhook URL"
                summary={ready ? short : undefined} onOpen={() => setOpen(1)}>
            <p className="step-help">
              {agent
                ? <>Prompt copied. Paste it into a new <strong>{AGENTS[agent].name}</strong> session in any folder. When it hands you the webhook URL, paste that below.</>
                : <>Copy this prompt into a new Claude Code or Codex session. It builds the workflow and hands you the webhook URL. Paste that below.</>}
            </p>
            <div className="prompt-block">
              <div className="prompt-head">
                <span className="mono subtle">setup prompt</span>
                <span className="prompt-actions">
                  {(Object.keys(AGENTS) as Agent[]).map(a => (
                    <button key={a} type="button" className="btn btn-secondary btn-md" onClick={() => { setAgent(a); copy('setup-' + a, SETUP_PROMPT); }}>
                      <img className="mini-mark" src={AGENTS[a].mark} alt="" />
                      {copied === 'setup-' + a ? 'Copied' : `Copy for ${AGENTS[a].name}`}
                    </button>
                  ))}
                </span>
              </div>
              <pre className="prompt-text">{SETUP_PROMPT}</pre>
            </div>
            <div className="paste">
              <label className="step-title sm" htmlFor="webhook">Then paste the webhook URL here</label>
              <div className="field">
                <input
                  id="webhook"
                  ref={inputRef}
                  className={`input ${result.state === 'ok' ? 'ok' : result.state === 'bad' ? 'bad' : ''}`}
                  type="url"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="https://next-api.freckle.io/v2/dataset-webhooks/…"
                  value={raw}
                  onChange={e => setRaw(e.target.value)}
                />
              </div>
              <div className={`status ${result.state}`} aria-live="polite">
                {result.state === 'idle' && <span>Waiting for a URL. Already have one from an existing webhook table? That works too.</span>}
                {result.state === 'ok' && (<><Icon name="circle-check-filled" size={12} /><span>Webhook accepted</span>{result.fixed && <span className="note">· rewrote next.freckle.io → next-api.freckle.io</span>}</>)}
                {result.state === 'bad' && (<><Icon name="circle-x-filled" size={12} /><span>Not a Freckle webhook URL. It should start with https://next-api.freckle.io/v2/dataset-webhooks/</span></>)}
              </div>
            </div>
          </Step>

          <Step n="02" status={open === 2 ? 'open' : dragged ? 'done' : 'todo'} title="Drag the bookmark into your bar"
                summary={dragged ? 'Send to Freckle · in your bookmarks bar' : undefined} onOpen={() => ready && setOpen(2)}>
            <p className="step-help">Click and hold the purple chip, drag it up to the bookmarks bar under your address field, let go. It saves as <strong>Send to Freckle</strong> with your webhook already inside.</p>
            <div className="drag-grid">
              <div>
                <span className="desktop-only-note">Bookmarks bars are a desktop thing. Open this page in Chrome, Edge, Safari or Firefox on your computer to install it.</span>
                <div className="dragbar">
                  <span className="grip"><Icon name="grip-vertical" size={16} /></span>
                  <a ref={chipRef} className="bm-chip" draggable title="Send to Freckle"
                     onClick={e => { e.preventDefault(); setNudge(true); }}
                     onDragStart={() => setNudge(false)}
                     onDragEnd={() => setDragged(true)}>
                    <img src="/ds/logos/stamp_black_full.svg" alt="" />Send to Freckle
                  </a>
                  <span className="hint"><Icon name="arrow-up" size={12} /> drag me up there</span>
                </div>
                {nudge && <span className="nudge">That's the bookmark itself. Drag it to the bar instead of clicking it here.</span>}
                <div className="kbd-row">
                  <span>Bookmarks bar hidden?</span>
                  <span className="kbd">⌘</span><span className="kbd">⇧</span><span className="kbd">B</span>
                  <span className="kbd-sep">/</span>
                  <span className="kbd">Ctrl</span><span className="kbd">⇧</span><span className="kbd">B</span>
                </div>
                <div className="kbd-row">
                  <span>Can't drag? <button type="button" className="linkbtn" onClick={() => copy('code', code)}>{copied === 'code' ? 'Copied' : 'Copy the code'}</button> and paste it as a new bookmark's URL.</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => { setDragged(true); setOpen(3); }}>
                  <Icon name="check" size={16} /> It's in my bar
                </button>
              </div>
              <DragDemo />
            </div>
          </Step>

          <Step n="03" status={open === 3 ? 'open' : 'todo'} title="Use it, then teach the workflow a play"
                onOpen={() => ready && setOpen(3)}>
            <p className="step-help">
              Open any page and click <strong>Send to Freckle</strong> in your bar. A small window confirms and closes itself; the URL is now a row. The workflow only classifies it so far. Each play below is a follow-up prompt for the <strong>same {agent ? AGENTS[agent].name : 'agent'} session</strong> that adds one branch. Edit the bracketed bits first.
            </p>
            <div className="plays">
              {PLAYS.map(p => (
                <div key={p.id} className="play">
                  <div className="play-head">
                    <span className="play-mark"><img src={p.mark} alt="" /></span>
                    <span className="play-title">{p.title}</span>
                    <button type="button" className="btn btn-secondary btn-md" onClick={() => copy(p.id, p.prompt)}>
                      <Icon name="copy" size={12} /> {copied === p.id ? 'Copied' : 'Copy prompt'}
                    </button>
                  </div>
                  <div className="play-io">
                    <span className="k">send</span><span>{p.send}</span>
                    <span className="k">get</span><span>{p.get}</span>
                  </div>
                  <pre className="play-prompt">{p.prompt}</pre>
                </div>
              ))}
            </div>
            <p className="step-help" style={{ fontSize: 'var(--text-xs)' }}>
              On a Sales Navigator lead the bookmark sends the person's regular <span className="mono">linkedin.com/in/</span> URL, so the LinkedIn play matches either page.
            </p>
          </Step>
        </div>
      </div>
    </section>
  );
});

Builder.displayName = 'Builder';

export default Builder;
