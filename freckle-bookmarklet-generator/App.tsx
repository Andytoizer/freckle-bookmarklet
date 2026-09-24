import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Generator from './components/Generator';
import Walkthrough from './components/Walkthrough';
import { buildBookmarklet } from './bookmarklet';

const App: React.FC = () => {
  const [hasGenerated, setHasGenerated] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const successRef = useRef<HTMLElement>(null);

  const handleGenerated = (url: string) => {
    setWebhookUrl(url);
    setHasGenerated(true);
  };

  useEffect(() => {
    if (hasGenerated && successRef.current) {
      // Small delay to ensure the DOM has rendered the new section and styles are applied
      const timer = setTimeout(() => {
        const element = successRef.current;
        if (element) {
          // Centering logic: Scroll to the top of the success section with a slight padding
          // A yOffset of 20 ensures the "Setup instructions" header starts near the top of the screen
          const yOffset = 20; 
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [hasGenerated]);

  const handleReset = () => {
    setWebhookUrl('');
    setHasGenerated(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyAgain = () => {
    const code = buildBookmarklet(webhookUrl);
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="min-h-screen text-[#1a1a1a] selection:bg-[#7c4dff] selection:text-white pb-20 overflow-x-hidden">
      {/* Container widened to max-w-6xl to allow the 4-column instructions to breathe */}
      <div className="max-w-6xl mx-auto px-6 pt-12 md:pt-20 space-y-16 md:space-y-24">
        <Header />

        <main className="w-full">
          {!hasGenerated ? (
            <div className="space-y-20">
              <section id="generator" className="animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both max-w-2xl mx-auto">
                <Generator onGenerated={handleGenerated} initialValue={webhookUrl} />
              </section>
            </div>
          ) : (
            <section 
              id="success-view" 
              ref={successRef}
              className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
            >
              <div className="pt-16 border-t border-gray-100">
                <Walkthrough />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                <button
                  onClick={handleCopyAgain}
                  className="w-full sm:w-auto px-10 py-5 bg-white border border-gray-200 rounded-[1.25rem] font-bold text-gray-700 hover:border-[#7c4dff] hover:text-[#7c4dff] transition-all shadow-sm active:scale-95"
                >
                  Copy code again
                </button>
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-10 py-5 bg-[#7c4dff] text-white rounded-[1.25rem] font-bold shadow-lg shadow-[#7c4dff]/20 hover:bg-[#6a3de8] transition-all active:scale-95"
                >
                  Create new bookmarklet
                </button>
              </div>
            </section>
          )}
        </main>

        <footer className="pt-20 border-t border-gray-100 text-[11px] text-gray-400">
          <div className="relative flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="font-medium tracking-tight">© Freckle {new Date().getFullYear()}</p>
            
            <div className="absolute left-1/2 -translate-x-1/2">
              <img 
                src="/logo.svg" 
                alt="Freckle" 
                className="h-5 w-auto"
              />
            </div>
            
            <div className="flex gap-8 text-[11px]">
              <a href="https://www.freckle.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
              <a href="https://www.freckle.io/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Terms of Service</a>
              <a href="https://www.freckle.io/dpa" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">DPA</a>
              <a href="https://trust.freckle.io/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Trust Center</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
