import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ds/Icon';
import { buildBookmarklet, normalizeWebhook } from '../bookmarklet';

const WEBHOOK_RE = /^https:\/\/next-api\.freckle\.io\/v2\/dataset-webhooks\/[^/\s]+\/[^/\s]+$/i;

type Check = { state: 'idle' | 'ok' | 'bad'; fixed: boolean };

const check = (raw: string): Check => {
  const trimmed = raw.trim();
  if (!trimmed) return { state: 'idle', fixed: false };
  const normalized = normalizeWebhook(trimmed);
  return { state: WEBHOOK_RE.test(normalized) ? 'ok' : 'bad', fixed: normalized !== trimmed };
};

const WhereToFind: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="disclosure" data-open={open}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Icon name="webhook" size={16} color="var(--gray-5)" />
        Where do I find my webhook URL?
        <span className="chev"><Icon name="chevron-down" size={16} /></span>
      </button>
      {open && (
        <div className="disclosure-body">
          <div>
            <span className="tag">New table</span>
            <div>Create a <strong>Webhook table</strong> in your workspace. Freckle shows the URL as soon as the table exists. Copy it.</div>
          </div>
          <div>
            <span className="tag">Existing table</span>
            <div>Click the <strong>Event</strong> column header, then <strong>Copy webhook URL</strong>.</div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StepProps {
  n: string;
  state: 'live' | 'done' | 'dim' | 'plain';
  title: string;
  help?: React.ReactNode;
  children?: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ n, state, title, help, children }) => (
  <div className={`step ${state}`}>
    <div className="step-num">
      <span className="n">{state === 'done' ? <Icon name="check" size={12} /> : n}</span>
      <span className="line" />
    </div>
    <div className="step-body">
      <h3 className="step-title">{title}</h3>
      {help && <p className="step-help">{help}</p>}
      {children}
    </div>
  </div>
);

const Builder = forwardRef<HTMLElement>((_, ref) => {
  const [raw, setRaw] = useState('');
  const [nudge, setNudge] = useState(false);
  const [copied, setCopied] = useState(false);
  const chipRef = useRef<HTMLAnchorElement>(null);

  const result = useMemo(() => check(raw), [raw]);
  const ready = result.state === 'ok';
  const code = useMemo(() => (ready ? buildBookmarklet(raw) : ''), [ready, raw]);

  // React refuses javascript: URLs in href, so the bookmarklet is set on the DOM node directly.
  useEffect(() => {
    chipRef.current?.setAttribute('href', code || '#');
  }, [code]);

  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="section" ref={ref} id="setup">
      <div className="wrap">
        <div className="section-head">
          <h2 className="h h2">Set it up</h2>
          <span className="eyebrow mono">about a minute</span>
        </div>

        <div className="steps">
          <Step n="01" state={ready ? 'done' : 'live'} title="Paste your Freckle webhook URL"
                help="The bookmark is built for this one table. Paste a different webhook to make another.">
            <div className="field">
              <input
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
              {result.state === 'idle' && <span>Waiting for a URL</span>}
              {result.state === 'ok' && (
                <>
                  <Icon name="circle-check-filled" size={12} />
                  <span>Webhook accepted</span>
                  {result.fixed && <span className="note">· rewrote next.freckle.io → next-api.freckle.io</span>}
                </>
              )}
              {result.state === 'bad' && (
                <>
                  <Icon name="circle-x-filled" size={12} />
                  <span>Not a Freckle webhook URL. It should start with https://next-api.freckle.io/v2/dataset-webhooks/</span>
                </>
              )}
            </div>
            <WhereToFind />
          </Step>

          <Step n="02" state={ready ? 'live' : 'dim'} title="Drag this into your bookmarks bar"
                help="Click and hold the chip, drag it up to the bar under your address field, let go. It saves as “Send to Freckle” with your webhook already inside.">
            <span className="desktop-only-note">Bookmarks bars are a desktop thing. Open this page in Chrome, Edge, Safari or Firefox on your computer to install it.</span>
            <div className="dragbar">
              <span className="grip"><Icon name="grip-vertical" size={16} /></span>
              <a
                ref={chipRef}
                className="bm-chip"
                draggable
                title="Send to Freckle"
                onClick={e => { e.preventDefault(); if (ready) setNudge(true); }}
                onDragStart={() => setNudge(false)}
              >
                <img src="/ds/logos/stamp_black_full.svg" alt="" />Send to Freckle
              </a>
              <span className="hint"><Icon name="arrow-up" size={12} /> drag to your browser's bookmarks bar</span>
            </div>
            {nudge && <span className="nudge">That's the bookmark itself. Drag it to the bar instead of clicking it here.</span>}
            <div className="kbd-row">
              <span>Bookmarks bar hidden?</span>
              <span className="kbd">⌘</span><span className="kbd">⇧</span><span className="kbd">B</span>
              <span className="kbd-sep">/</span>
              <span className="kbd">Ctrl</span><span className="kbd">⇧</span><span className="kbd">B</span>
              <span className="kbd-sep">·</span>
              <span>Can't drag? <button type="button" className="linkbtn" onClick={copy}>{copied ? 'Copied' : 'Copy the code'}</button> and paste it as a new bookmark's URL.</span>
            </div>
          </Step>

          <Step n="03" state="plain" title="Click it on a page"
                help="Open the page you want in Freckle, click “Send to Freckle” in your bar. A small window confirms and closes itself.">
            <div className="rows">
              <div className="rows-head"><span /><span>You're on</span><span>What lands in your table</span></div>
              <div className="row"><img src="/ds/marks/linkedin.svg" alt="" /><span>LinkedIn profile</span><span className="what">linkedin.com/in/<span className="subtle">…</span></span></div>
              <div className="row"><img src="/ds/marks/linkedin.svg" alt="" /><span>Sales Navigator lead</span><span className="what"><span className="p">→</span> linkedin.com/in/<span className="subtle">…</span></span></div>
              <div className="row"><img src="/ds/marks/hubspot.svg" alt="" /><span>HubSpot contact or company</span><span className="what">the record URL</span></div>
              <div className="row"><img src="/ds/marks/salesforce.svg" alt="" /><span>Salesforce record</span><span className="what">the record URL</span></div>
              <div className="row"><span className="mk" style={{ color: 'var(--gray-6)' }}><Icon name="building" size={16} /></span><span>Any company website</span><span className="what">the page URL</span></div>
            </div>
            <p className="step-help" style={{ fontSize: 'var(--text-xs)' }}>
              On a Sales Navigator lead, it sends the person's regular <span className="mono">linkedin.com/in/</span> URL instead of the Sales Navigator one, so enrichment columns can match it.
            </p>
          </Step>
        </div>
      </div>
    </section>
  );
});

Builder.displayName = 'Builder';

export default Builder;
