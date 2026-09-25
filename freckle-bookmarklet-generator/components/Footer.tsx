import React from 'react';

const Footer: React.FC = () => (
  <footer className="footer">
    <div className="wrap">
      <a className="wordmark" href="https://www.freckle.io" target="_blank" rel="noopener noreferrer" aria-label="Freckle">
        <img src="/ds/logos/logo_black_full.svg" alt="freckle_" />
      </a>
      <span className="cli">❯ npx freckle login</span>
      <nav className="links">
        <a href="/rules">Build rules</a>
        <a href="https://www.freckle.io/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy</a>
        <a href="https://www.freckle.io/terms-of-service" target="_blank" rel="noopener noreferrer">Terms</a>
        <a href="https://www.freckle.io/dpa" target="_blank" rel="noopener noreferrer">DPA</a>
        <a href="https://trust.freckle.io/" target="_blank" rel="noopener noreferrer">Trust center</a>
      </nav>
      <div className="copy">© {new Date().getFullYear()} Freckle.io Inc.</div>
    </div>
  </footer>
);

export default Footer;
