import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../ds/Icon';
import { buildBookmarklet, normalizeWebhook } from '../bookmarklet';
import { DEFAULT_NAME, WEBHOOK_RE } from '../prompts';
import DragStep from './DragStep';
import PlayGrid from './PlayGrid';

// /install?webhook=…&name=… : the teammate page. One job: get the bookmark into their bar.
const Install: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const webhook = normalizeWebhook(params.get('webhook') || '');
  const name = (params.get('name') || '').trim().slice(0, 40) || DEFAULT_NAME;
  const valid = WEBHOOK_RE.test(webhook);
  const code = useMemo(() => (valid ? buildBookmarklet(webhook) : ''), [valid, webhook]);
  const [dragged, setDragged] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { document.title = `${name} — Freckle bookmark`; }, [name]);

  if (!valid) {
    return (
      <section className="wrap hero">
        <div className="hero-copy">
          <h1 className="h h1">This link is missing its webhook</h1>
          <p className="lede">Ask whoever shared it to copy the link again from their setup page.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="wrap hero install-hero">
        <div className="hero-copy">
          <span className="eyebrow mono">a teammate set this up for you</span>
          <h1 className="h h1">Add the {name} bookmark to your browser</h1>
          <p className="lede">Drag it into your bookmarks bar. That's the whole install. Click it on any page to send that page into Freckle.</p>
        </div>
      </section>

      <section className="section install-body">
        <div className="wrap">
          {done ? (
            <div className="install-done">
              <span className="done-mark"><Icon name="check" size={16} /></span>
              <div>
                <h3 className="h h3">You're set</h3>
                <p className="step-help">On any page, click <strong>{name}</strong> in your bookmarks bar. A small window confirms and closes, and the page lands in the team's Freckle workbook. Keep it to one click per page.</p>
              </div>
            </div>
          ) : (
            <DragStep code={code} name={name} dragged={dragged} onDragged={() => setDragged(true)}
                      onConfirm={() => setDone(true)} continueLabel="I'm done" />
          )}
        </div>
      </section>

      {done && (
        <section className="wrap plays-intro install-plays">
          <div className="section-head">
            <h2 className="h h2">What the bookmark can do</h2>
          </div>
          <p className="step-help">Which of these run on a page depends on what your teammate has wired up in Freckle. Want one that isn't there yet? Ask them to add it.</p>
          <PlayGrid />
        </section>
      )}
    </>
  );
};

export default Install;
