import React, { useState } from 'react';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Builder, { type InitialAction } from './components/Builder';
import Notes from './components/Notes';
import Footer from './components/Footer';

// The setup section stays hidden until someone picks a way in, or arrives on the agent's return link.
const arrivedWithWebhook = () => new URLSearchParams(window.location.search).has('webhook');

const App: React.FC = () => {
  const [initial, setInitial] = useState<InitialAction | null>(() => (arrivedWithWebhook() ? { kind: 'none' } : null));

  return (
    <>
      <Nav />
      <main>
        <Hero
          onAgent={agent => setInitial({ kind: 'agent', agent })}
          onCopy={() => setInitial({ kind: 'copy' })}
          onSkip={() => setInitial({ kind: 'paste' })}
        />
        {initial && <Builder initial={initial} />}
        <Notes />
      </main>
      <Footer />
    </>
  );
};

export default App;
