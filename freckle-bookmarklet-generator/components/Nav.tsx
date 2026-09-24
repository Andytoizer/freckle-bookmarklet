import React from 'react';
import Icon from '../ds/Icon';

const Nav: React.FC = () => (
  <header className="nav">
    <div className="wrap">
      <a className="wordmark" href="https://www.freckle.io" target="_blank" rel="noopener noreferrer" aria-label="Freckle">
        <img src="/ds/logos/logo_black_full.svg" alt="freckle_" />
      </a>
      <span style={{ flex: 1 }} />
      <a className="plain hide-sm" href="https://www.freckle.io/pricing" target="_blank" rel="noopener noreferrer">Pricing</a>
      <a className="plain hide-sm" href="https://docs.freckle.io" target="_blank" rel="noopener noreferrer">Docs</a>
      <a className="btn btn-primary btn-md" href="https://app.freckle.io" target="_blank" rel="noopener noreferrer">
        Open Freckle <Icon name="arrow-up-right" size={12} />
      </a>
    </div>
  </header>
);

export default Nav;
