import React, { useEffect, useState } from 'react';
import Icon from '../ds/Icon';
import { DEFAULT_NAME, installUrl } from '../prompts';

interface ShareModalProps {
  webhook: string;
  onClose: () => void;
}

// Builds a teammate link: a page with only the bookmark to drag in, under whatever name they pick here.
const ShareModal: React.FC<ShareModalProps> = ({ webhook, onClose }) => {
  const [name, setName] = useState(DEFAULT_NAME);
  const [copied, setCopied] = useState(false);
  const link = installUrl(webhook, name.trim() || DEFAULT_NAME);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const copyLink = () => navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="modal-head">
          <h3 id="share-title" className="h h3">Share the bookmark with your team</h3>
          <button type="button" className="modal-x" aria-label="Close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <p className="step-help">Teammates get a page with just the bookmark to drag into their bookmarks bar. No setup on their end. Every page they send lands in your workbook.</p>

        <label className="modal-label" htmlFor="bm-name">Bookmark name</label>
        <input id="bm-name" className="input sans" type="text" value={name} maxLength={40} spellCheck={false}
               placeholder={DEFAULT_NAME} onChange={e => setName(e.target.value)} />
        <span className="modal-hint">What shows in their bookmarks bar. Name it for the play if you like, e.g. Enrich LinkedIn profile.</span>

        <label className="modal-label" htmlFor="bm-link">Link to share</label>
        <div className="field">
          <input id="bm-link" className="input" type="url" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <button type="button" className="btn btn-primary" onClick={copyLink}>
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <span className="modal-hint warn"><Icon name="alert-triangle" size={12} /> The link carries your webhook. Anyone who has it can add rows to your workbook, so keep it inside the team.</span>
      </div>
    </div>
  );
};

export default ShareModal;
