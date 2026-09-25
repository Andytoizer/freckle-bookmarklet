import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// The agent hands back ?webhook=<url>; read it once and clear it from the address bar.
const webhookFromUrl = (): string => {
  const w = new URLSearchParams(window.location.search).get('webhook') || '';
  if (w) window.history.replaceState(null, '', window.location.pathname);
  return w;
};

export type InitialAction = { kind: 'agent'; agent: Agent } | { kind: 'copy' } | { kind: 'paste' } | { kind: 'none' };

interface BuilderProps {
  // What the person picked from Get started; acted on when the section mounts and whenever it changes.
  initial: InitialAction;
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

// The how-to recording (public/drag-demo.gif) sits beside the button. It carries its own browser frame.
const DragDemo: React.FC = () => (
  <div className="demo">
    <img className="demo-gif" src="/drag-demo.gif" alt="Dragging the Send to Freckle button into the bookmarks bar" />
  </div>
);

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

const Builder: React.FC<BuilderProps> = ({ initial }) => {
  const [raw, setRaw] = useState(webhookFromUrl);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [open, setOpen] = useState<1 | 2 | 3>(1);
  const [dragged, setDragged] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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

  // Advance as soon as the webhook is valid.
  useEffect(() => {
    if (ready && open === 1) setOpen(2);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollHere = () => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const focusPaste = () => setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 400);

  const launch = (agent: Agent) => {
    const def = AGENTS[agent];
    copy('setup', SETUP_PROMPT);
    setNotice(`${def.fallback} When it's done, it gives you a link back to this page.`);
    if (def.link) window.location.href = def.link(SETUP_PROMPT);
  };

  const copyPrompt = () => {
    copy('setup', SETUP_PROMPT);
    setNotice('Prompt copied. Paste it into any coding agent. When it’s done, it gives you a link back to this page.');
  };

  // Mounted by a Get started choice, or by the agent's return link. Runs again if they pick another option.
  useEffect(() => {
    const t = setTimeout(() => {
      if (initial.kind !== 'none') setOpen(1);
      scrollHere();
      if (initial.kind === 'agent') launch(initial.agent);
      if (initial.kind === 'copy') copyPrompt();
      if (initial.kind === 'paste') focusPaste();
    }, 60);
    return () => clearTimeout(t);
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const short = webhook.replace('https://next-api.freckle.io/v2/dataset-webhooks/', '…/').replace(/\/[^/]+$/, '/…');
  // Each play names the workflow by its webhook, so the prompt works even in a brand-new agent session.
  const playPrompt = (prompt: string, display = false) => `In Freckle, open the workflow whose webhook URL is ${webhook ? (display ? short : webhook) : '<your webhook URL>'} (the "Send to Freckle" bookmark workflow).\n\n${prompt}`;

  return (
    <section className="section" ref={sectionRef} id="setup">
      <div className="wrap">
        <div className="section-head">
          <h2 className="h h2">Set it up</h2>
          <span className="eyebrow mono">three steps</span>
        </div>

        <div className="steps">
          <Step n="01" status={open === 1 ? 'open' : ready ? 'done' : 'todo'} title="Paste your webhook URL"
                summary={ready ? short : undefined} onOpen={() => setOpen(1)}>
            <p className="step-help">
              {notice ?? 'Your coding agent builds the workflow and hands you a webhook URL. Paste it here.'}
            </p>
            <div className="paste">
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
                  aria-label="Freckle webhook URL"
                />
              </div>
              <div className={`status ${result.state}`} aria-live="polite">
                {result.state === 'idle' && <span>Waiting for a URL. If the agent gives you a link back to this page, clicking it fills this in.</span>}
                {result.state === 'ok' && (<><Icon name="circle-check-filled" size={12} /><span>Webhook accepted</span>{result.fixed && <span className="note">· rewrote next.freckle.io → next-api.freckle.io</span>}</>)}
                {result.state === 'bad' && (<><Icon name="circle-x-filled" size={12} /><span>Not a Freckle webhook URL. It should start with https://next-api.freckle.io/v2/dataset-webhooks/</span></>)}
              </div>
            </div>

            <div className="agent-strip">
              <span className="mono subtle">need the setup prompt?</span>
              {(Object.keys(AGENTS) as Agent[]).map(a => (
                <button key={a} type="button" className="btn btn-secondary btn-md" onClick={() => launch(a)}>
                  <img className="mini-mark" src={AGENTS[a].mark} alt="" />{AGENTS[a].name}<Icon name="arrow-up-right" size={12} color="var(--gray-5)" />
                </button>
              ))}
              <button type="button" className="btn btn-secondary btn-md" onClick={copyPrompt}>
                <Icon name="copy" size={12} /> {copied === 'setup' ? 'Copied' : 'Copy'}
              </button>
              <button type="button" className="linkbtn" onClick={() => setShowPrompt(s => !s)}>{showPrompt ? 'Hide the prompt' : 'Show the prompt'}</button>
            </div>
            {showPrompt && (
              <div className="prompt-dark full">
                <pre>{SETUP_PROMPT}</pre>
                <button type="button" className="prompt-copy" title="Copy prompt" onClick={copyPrompt}>
                  <Icon name={copied === 'setup' ? 'check' : 'copy'} size={16} />
                </button>
              </div>
            )}
          </Step>

          <Step n="02" status={open === 2 ? 'open' : dragged ? 'done' : 'todo'} title="Drag the Send to Freckle button into your bookmarks bar"
                summary={dragged ? 'Send to Freckle · in your bookmarks bar' : undefined} onOpen={() => ready && setOpen(2)}>
            <div className="drag-grid">
              <div className="drag-col">
                <p className="step-help">Click and hold the <strong>Send to Freckle</strong> bookmark, drag it up into the bookmarks bar under your search bar, let go.</p>
                <span className="desktop-only-note">Bookmarks bars are a desktop thing. Open this page in Chrome, Edge, Safari or Firefox on your computer to install it.</span>
                <div className="dragbar">
                  <span className="grip"><Icon name="grip-vertical" size={16} /></span>
                  <a ref={chipRef} className="bm-chip" draggable title="Send to Freckle"
                     onClick={e => { e.preventDefault(); setNudge(true); }}
                     onDragStart={() => setNudge(false)}
                     onDragEnd={() => setDragged(true)}>
                    <img src="/ds/logos/stamp_black_full.svg" alt="" />Send to Freckle
                  </a>
                  <span className="hint"><Icon name="arrow-up" size={12} /><span>drag me to your bookmarks bar</span></span>
                </div>
                {nudge && <span className="nudge">That's the bookmark itself. Drag it up to your bookmarks bar instead of clicking it here.</span>}
                {dragged && (
                  <button type="button" className="btn btn-primary confirm" onClick={() => setOpen(3)}>
                    <Icon name="check" size={16} /> It's in my bookmarks bar
                  </button>
                )}
                <button type="button" className="linkbtn help-toggle" onClick={() => setShowHelp(h => !h)}>{showHelp ? 'Hide help' : 'Bookmark not showing up?'}</button>
                {showHelp && (
                  <>
                    <div className="kbd-row">
                      <span>Bookmarks bar hidden?</span>
                      <span className="kbd">⌘</span><span className="kbd">⇧</span><span className="kbd">B</span>
                      <span className="kbd-sep">/</span>
                      <span className="kbd">Ctrl</span><span className="kbd">⇧</span><span className="kbd">B</span>
                    </div>
                    <div className="kbd-row">
                      <span>Dragging didn't take? <button type="button" className="linkbtn" onClick={() => copy('code', code)}>{copied === 'code' ? 'Copied' : 'Copy the code'}</button> and paste it as a new bookmark's URL.</span>
                    </div>
                    <div className="kbd-row">
                      <span>Already dragged it? <button type="button" className="linkbtn" onClick={() => { setDragged(true); setOpen(3); }}>Continue to plays</button></span>
                    </div>
                  </>
                )}
              </div>
              <DragDemo />
            </div>
          </Step>

          <Step n="03" status={open === 3 ? 'open' : 'todo'} title="Bookmark-driven playbooks"
                onOpen={() => ready && setOpen(3)}>
            <ol className="how how-inline">
              <li><span className="mono n">1</span><span>On any page, click <strong>Send to Freckle</strong> in your bookmarks bar. A small window confirms and closes.</span></li>
              <li><span className="mono n">2</span><span>The URL lands as a row. For now the workflow only sorts it by type.</span></li>
              <li><span className="mono n">3</span><span>Pick a play. Paste its prompt into the <strong>same agent session</strong>. Edit the [bracketed] bits first.</span></li>
            </ol>
          </Step>
        </div>

        {open === 3 && (
          <div className="plays">
            {PLAYS.map(p => (
                <div key={p.id} className="play">
                  <div className="play-head">
                    <span className="play-marks">{p.marks.map(m => <span key={m} className="play-mark"><img src={m} alt="" /></span>)}</span>
                    <span className="play-title">{p.title}</span>
                  </div>
                  <div className="play-io">
                    <span className="k">send</span><span>{p.send}</span>
                    <span className="k">get</span><span>{p.get}</span>
                  </div>
                  <pre className="play-prompt">{playPrompt(p.prompt, true)}</pre>
                  <div className="play-foot">
                    <button type="button" className="btn btn-secondary btn-md" onClick={() => copy(p.id, playPrompt(p.prompt))}>
                      <Icon name="copy" size={12} /> {copied === p.id ? 'Copied' : 'Copy prompt'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Builder;
