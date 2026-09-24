import React from 'react';

const Notes: React.FC = () => (
  <section className="section">
    <div className="wrap">
      <div className="notes">
        <div>
          <h3 className="h h3">Is it safe to use on LinkedIn?</h3>
          <p>It reads what's already on the page and sends the URL to Freckle. Nothing is sent to LinkedIn, nothing is installed, and it only runs when you click. Keep it one click per page. Don't wire it into anything that loops through lists.</p>
        </div>
        <div>
          <h3 className="h h3">Where does the code run?</h3>
          <p>In your browser, in the tab you're looking at. The bookmark holds a short script with your webhook URL in it. There's no extension, no account, and no AI in the loop. Anyone with the bookmark can add rows to your table, so don't share it outside your team.</p>
        </div>
      </div>
    </div>
  </section>
);

export default Notes;
