import React, { useRef } from 'react';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Builder from './components/Builder';
import After from './components/After';
import Notes from './components/Notes';
import Footer from './components/Footer';

const App: React.FC = () => {
  const setupRef = useRef<HTMLElement>(null);
  const scrollToSetup = () => {
    setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setupRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  };

  return (
    <>
      <Nav />
      <main>
        <Hero onStart={scrollToSetup} />
        <Builder ref={setupRef} />
        <After />
        <Notes />
      </main>
      <Footer />
    </>
  );
};

export default App;
