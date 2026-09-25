import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ds/Icon';

interface DragStepProps {
  // The javascript: bookmarklet. Empty until a webhook is valid.
  code: string;
  // Bookmark name; what shows in the bookmarks bar.
  name: string;
  dragged: boolean;
  onDragged: () => void;
  // Called by the confirm button after a drag, and by the "already dragged it" link.
  onConfirm: () => void;
  confirmLabel?: string;
  continueLabel?: string;
}

// The how-to recording (public/drag-demo.gif) sits beside the bookmark. It carries its own browser frame.
const DragDemo: React.FC = () => (
  <div className="demo">
    <img className="demo-gif" src="/drag-demo.gif" alt="Dragging the bookmark into the bookmarks bar" />
  </div>
);

// Step 2 on the setup page and the whole of the teammate install page share this.
const DragStep: React.FC<DragStepProps> = ({ code, name, dragged, onDragged, onConfirm, confirmLabel = "It's in my bookmarks bar", continueLabel = 'Continue' }) => {
  const [nudge, setNudge] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const chipRef = useRef<HTMLAnchorElement>(null);

  // React refuses javascript: URLs in href, so the bookmarklet is set on the DOM node directly.
  useEffect(() => {
    chipRef.current?.setAttribute('href', code || '#');
  }, [code]);

  const copyCode = () => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });

  return (
    <div className="drag-grid">
      <div className="drag-col">
        <p className="step-help">Click and hold the <strong>{name}</strong> bookmark, drag it up into the bookmarks bar under your search bar, let go.</p>
        <span className="desktop-only-note">Bookmarks bars are a desktop thing. Open this page in Chrome, Edge, Safari or Firefox on your computer to install it.</span>
        <div className="dragbar">
          <span className="grip"><Icon name="grip-vertical" size={16} /></span>
          <a ref={chipRef} className="bm-chip" draggable title={name}
             onClick={e => { e.preventDefault(); setNudge(true); }}
             onDragStart={() => setNudge(false)}
             onDragEnd={onDragged}>
            <img src="/ds/logos/stamp_black_full.svg" alt="" />{name}
          </a>
          <span className="hint"><Icon name="arrow-up" size={12} /><span>drag me to your bookmarks bar</span></span>
        </div>
        {nudge && <span className="nudge">That's the bookmark itself. Drag it up to your bookmarks bar instead of clicking it here.</span>}
        {dragged && (
          <button type="button" className="btn btn-primary confirm" onClick={onConfirm}>
            <Icon name="check" size={16} /> {confirmLabel}
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
              <span>Dragging didn't take? <button type="button" className="linkbtn" onClick={copyCode}>{copied ? 'Copied' : 'Copy the code'}</button> and paste it as a new bookmark's URL, named <strong>{name}</strong>.</span>
            </div>
            <div className="kbd-row">
              <span>Already dragged it? <button type="button" className="linkbtn" onClick={() => { onDragged(); onConfirm(); }}>{continueLabel}</button></span>
            </div>
          </>
        )}
      </div>
      <DragDemo />
    </div>
  );
};

export default DragStep;
