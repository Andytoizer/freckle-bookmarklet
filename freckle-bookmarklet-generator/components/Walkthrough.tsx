
import React from 'react';

const Walkthrough: React.FC = () => {
  const steps = [
    {
      number: 1,
      title: "Drag it to your bookmarks bar",
      description: "Drag the \"Send to Freckle\" button above into your bookmarks bar. It's named and ready to go."
    },
    {
      number: 2,
      title: "Click it on any page",
      description: "On a LinkedIn profile, Sales Navigator lead, CRM record or website, click \"Send to Freckle\" to send it to your table."
    },
    {
      number: 3,
      title: "Create enrichment columns",
      description: "In your Freckle webhook table, add columns to enrich for the specific data points you need."
    },
    {
      number: 4,
      title: "Route your data",
      description: "Create columns to send enriched records back to your CRM or a Slack channel."
    }
  ];

  return (
    <div className="space-y-16">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-[800] tracking-tight text-[#1a1a1a]">Setup instructions</h2>
        <p className="text-gray-500 text-lg font-medium">Follow these steps to start using your bookmarklet</p>
      </div>
      
      {/* 4-column grid matches the wider container from App.tsx */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col space-y-5 p-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:border-[#7c4dff]/20 transition-all group">
            <div className="w-10 h-10 bg-[#7c4dff] text-white rounded-xl flex items-center justify-center font-bold text-lg shrink-0 group-hover:scale-110 transition-transform">
              {step.number}
            </div>
            <div className="space-y-3 text-left w-full flex flex-col items-start">
              {/* min-h ensures that descriptions start at the same vertical position regardless of title length */}
              <h3 className="font-[800] text-xl leading-[1.2] text-[#1a1a1a] m-0 p-0 text-left min-h-[3.25rem] flex items-start">
                {step.title}
              </h3>
              <p className="text-gray-500 text-[15px] leading-relaxed font-medium m-0 p-0 text-left">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary box with text sized to match the headers (text-xl) */}
      <div className="max-w-5xl mx-auto bg-gray-50 rounded-[2.5rem] px-10 py-8 md:py-10 border border-gray-100 flex items-center justify-center">
        <p className="text-xl text-gray-600 leading-relaxed font-bold text-center">
          Once set up, click your bookmarklet to send the page to Freckle, automatically enrich it, and route the data where it needs to go.
        </p>
      </div>
    </div>
  );
};

export default Walkthrough;
