import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ds/Icon';
import { buildBookmarklet, normalizeWebhook } from '../bookmarklet';
import { AGENTS, DEFAULT_NAME, PLAYS, RULES_URL, SETUP_PROMPT, WEBHOOK_RE, type Agent } from '../prompts';
import DragStep from './DragStep';
import ShareModal from './ShareModal';

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
  const [share, setShare] = useState(false);
  const { copied, copy } = useCopy();
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => check(raw), [raw]);
  const ready = result.state === 'ok';
  const webhook = ready ? normalizeWebhook(raw) : '';
  const code = useMemo(() => (ready ? buildBookmarklet(raw) : ''), [ready, raw]);

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
  // Copied plays end with where they go and the webhook, so the prompt works even in a brand-new agent session.
  const playPrompt = (p: { prompt: string; where: string }) => `${p.prompt}\n\n${p.where} in the Freckle workbook "Freckle bookmark", the workflow whose webhook URL is ${webhook || '<your webhook URL>'}. Read and follow ${RULES_URL} before you start and before you report back.`;

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
            <DragStep code={code} name={DEFAULT_NAME} dragged={dragged} onDragged={() => setDragged(true)}
                      onConfirm={() => setOpen(3)} continueLabel="Continue to plays" />
          </Step>

          <Step n="03" status={open === 3 ? 'open' : 'todo'} title="Bookmark-driven playbooks"
                onOpen={() => ready && setOpen(3)}>
            <ol className="how how-inline">
              <li><span className="mono n">1</span><span>On any page, click <strong>Send to Freckle</strong> in your bookmarks bar. A small window confirms and closes.</span></li>
              <li><span className="mono n">2</span><span>The URL lands as a row. For now the workflow only sorts it by type.</span></li>
              <li><span className="mono n">3</span><span>Pick a play. Paste its prompt into the <strong>same agent session</strong>. Edit the [bracketed] bits first.</span></li>
            </ol>
            <div className="share-row">
              <div>
                <span className="share-title">Give the bookmark to your team</span>
                <span className="share-sub">Teammates get a page with just the bookmark to drag in. Nothing to set up on their end.</span>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setShare(true)}>
                <Icon name="link" size={16} /> Share with teammates
              </button>
            </div>
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
                  <pre className="play-prompt">{p.prompt}</pre>
                  <div className="play-foot">
                    <button type="button" className="btn btn-secondary btn-md" onClick={() => copy(p.id, playPrompt(p))}>
                      <Icon name="copy" size={12} /> {copied === p.id ? 'Copied' : 'Copy prompt'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      {share && <ShareModal webhook={webhook} onClose={() => setShare(false)} />}
    </section>
  );
};

export default Builder;
