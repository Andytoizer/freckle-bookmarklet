
import React, { useState, useCallback } from 'react';
import { buildBookmarklet } from '../bookmarklet';

interface GeneratorProps {
  onGenerated: (url: string) => void;
  initialValue?: string;
}

const Generator: React.FC<GeneratorProps> = ({ onGenerated, initialValue = '' }) => {
  const [webhookUrl, setWebhookUrl] = useState(initialValue);
  const [isCopying, setIsCopying] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleCopy = useCallback(() => {
    if (!webhookUrl) return;
    setIsCopying(true);
    
    const code = buildBookmarklet(webhookUrl);
    
    navigator.clipboard.writeText(code).then(() => {
      onGenerated(webhookUrl);
    });
  }, [webhookUrl, onGenerated]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Input and Primary Action Area */}
      <div className="space-y-5 w-full">
        <div className="relative group">
          <input
            type="url"
            placeholder="Paste your Freckle Webhook URL here..."
            className="w-full bg-white border-2 border-[#1a1a1a]/10 rounded-[1.5rem] px-8 py-6 text-xl shadow-[0_15px_45px_-15px_rgba(0,0,0,0.1)] hover:border-[#7c4dff]/40 focus:outline-none focus:ring-8 focus:ring-[#7c4dff]/10 focus:border-[#7c4dff] transition-all placeholder:text-gray-400 font-semibold"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <button
          onClick={handleCopy}
          disabled={!webhookUrl || isCopying}
          className={`w-full py-6 rounded-[1.5rem] font-extrabold text-xl transition-all duration-300 transform active:scale-[0.98] shadow-2xl ${
            webhookUrl 
              ? 'bg-[#7c4dff] text-white hover:bg-[#6a3de8] hover:-translate-y-0.5 shadow-[#7c4dff]/30' 
              : 'bg-gray-50 text-gray-300 cursor-not-allowed shadow-none'
          }`}
        >
          {isCopying ? 'Generating...' : 'Copy Bookmarklet Code'}
        </button>

        <div className="text-center pt-8">
          <button 
            onClick={() => setShowModal(true)}
            className="text-sm font-bold text-gray-400 hover:text-[#7c4dff] transition-colors inline-flex items-center gap-2 group"
          >
            <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] group-hover:bg-[#7c4dff]/5">?</span>
            How to find your Freckle webhook
          </button>
        </div>
      </div>

      {/* Help Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="space-y-10">
              <div className="text-left">
                <h2 className="text-3xl font-[800] tracking-tight text-[#1a1a1a] mb-2">Finding your webhook</h2>
                <p className="text-gray-500 font-medium">Follow either method below to get your unique URL.</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-2.5 py-0.5 bg-[#7c4dff]/10 text-[#7c4dff] rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Method A
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#1a1a1a]">New Webhook Table</h3>
                    <p className="text-gray-600 text-[15px] leading-relaxed">
                      Create a new <strong>Webhook table</strong> in your workspace. Freckle will immediately generate a unique URL for you to copy.
                    </p>
                  </div>
                </div>
                <div className="space-y-4 md:border-l md:border-gray-100 md:pl-12">
                  <div className="inline-flex items-center px-2.5 py-0.5 bg-[#7c4dff]/10 text-[#7c4dff] rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Method B
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#1a1a1a]">Existing Tables</h3>
                    <p className="text-gray-600 text-[15px] leading-relaxed">
                      Click the <strong>"Event"</strong> column header in an existing table and select <strong>"Copy webhook URL"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="w-full py-4 bg-[#1a1a1a] text-white rounded-2xl font-bold hover:bg-black transition-all"
              >
                Got it
              </button>
            </div>
          </div>
          {/* Backdrop Click */}
          <div className="absolute inset-0 -z-10" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
};

export default Generator;
