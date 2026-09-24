import React, { useRef } from 'react';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Builder, { type BuilderHandle } from './components/Builder';
import Notes from './components/Notes';
import Footer from './components/Footer';

const App: React.FC = () => {
  const builder = useRef<BuilderHandle>(null);

  return (
    <>
      <Nav />
      <main>
        <Hero
          onAgent={a => builder.current?.launch(a)}
          onCopy={() => builder.current?.copyPrompt()}
          onSkip={() => builder.current?.skipToPaste()}
        />
        <Builder ref={builder} />
        <Notes />
      </main>
      <Footer />
    </>
  );
};

export default App;
