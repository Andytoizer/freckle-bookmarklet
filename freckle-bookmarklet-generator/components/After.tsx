import React from 'react';
import Icon from '../ds/Icon';

const After: React.FC = () => (
  <section className="section">
    <div className="wrap">
      <div className="section-head">
        <h2 className="h h2">After it lands</h2>
        <span className="eyebrow mono">in Freckle</span>
      </div>
      <div className="after">
        <div>
          <span className="k">01 · row</span>
          <span className="t">The URL shows up as a new row</span>
          <p>In the webhook table you pasted above, a second or two after you click.</p>
          <div className="marks"><span style={{ color: 'var(--type-table)' }}><Icon name="table" size={12} /></span></div>
        </div>
        <div>
          <span className="k">02 · enrich</span>
          <span className="t">Add columns to fill in the rest</span>
          <p>Work email from Findymail, person data from AI Ark, company data from People Data Labs. Columns run on every new row.</p>
          <div className="marks"><span style={{ color: 'var(--warning)' }}><Icon name="columns-3" size={12} /></span><span style={{ color: 'var(--type-agent)' }}><Icon name="wand" size={12} /></span></div>
        </div>
        <div>
          <span className="k">03 · route</span>
          <span className="t">Send it where the team works</span>
          <p>Create or update the record in HubSpot or Salesforce, or post it to a Slack channel.</p>
          <div className="marks">
            <span><img src="/ds/marks/hubspot.svg" alt="HubSpot" /></span>
            <span><img src="/ds/marks/salesforce.svg" alt="Salesforce" /></span>
            <span><img src="/ds/marks/slack.svg" alt="Slack" /></span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default After;
