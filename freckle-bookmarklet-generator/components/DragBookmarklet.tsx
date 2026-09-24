import React, { useEffect, useRef, useState } from 'react';
import { buildBookmarklet } from '../bookmarklet';

interface DragBookmarkletProps {
  webhookUrl: string;
}

const DragBookmarklet: React.FC<DragBookmarkletProps> = ({ webhookUrl }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [clickedInstead, setClickedInstead] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGif, setShowGif] = useState(true);

  // React blocks javascript: URLs in href, so the bookmarklet code is set on the DOM node directly.
  useEffect(() => {
    linkRef.current?.setAttribute('href', buildBookmarklet(webhookUrl));
  }, [webhookUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildBookmarklet(webhookUrl)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-2xl mx-auto text-center space-y-8">
      <div className="space-y-3">
        <h2 className="text-4xl font-[800] tracking-tight text-[#1a1a1a]">Drag this to your bookmarks bar</h2>
        <p className="text-gray-500 text-lg font-medium">
          Click and hold the button, then drop it onto your bookmarks bar. It'll be saved as "Send to Freckle".
        </p>
      </div>

      <div className="py-6">
        <a
          ref={linkRef}
          draggable
          onClick={(e) => {
            e.preventDefault();
            setClickedInstead(true);
          }}
          className="inline-flex items-center gap-3 px-10 py-6 bg-[#7c4dff] text-white rounded-[1.5rem] font-extrabold text-2xl shadow-2xl shadow-[#7c4dff]/30 cursor-grab active:cursor-grabbing hover:bg-[#6a3de8] hover:-translate-y-0.5 transition-all select-none"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Send to Freckle
        </a>
        {clickedInstead && (
          <p className="mt-5 text-sm font-bold text-[#7c4dff]">
            Don't click it here. Drag it up to your bookmarks bar instead.
          </p>
        )}
      </div>

      {showGif && (
        <img
          src="/drag-demo.gif"
          alt="Dragging the Send to Freckle button into the bookmarks bar"
          className="w-full rounded-[1.5rem] border border-gray-100 shadow-sm"
          onError={() => setShowGif(false)}
        />
      )}

      <div className="bg-gray-50 rounded-[1.5rem] border border-gray-100 px-8 py-6 text-left space-y-2">
        <p className="text-[15px] text-gray-600 font-medium">
          <strong className="text-[#1a1a1a]">Don't see your bookmarks bar?</strong> Press{' '}
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-sm">⌘ Shift B</kbd> on Mac or{' '}
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-sm">Ctrl Shift B</kbd> on Windows.
        </p>
        <p className="text-[15px] text-gray-600 font-medium">
          <strong className="text-[#1a1a1a]">Can't drag it?</strong>{' '}
          <button onClick={handleCopy} className="font-bold text-[#7c4dff] hover:underline">
            {copied ? 'Copied!' : 'Copy the code'}
          </button>{' '}
          and paste it as the URL of a new bookmark.
        </p>
      </div>
    </div>
  );
};

export default DragBookmarklet;
