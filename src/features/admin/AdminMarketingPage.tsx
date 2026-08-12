import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'campaigns' | 'ads';

/** App campaigns and Ad/banner publishing used to be two separate pages —
 * both are "marketing content pushed to the customer app," just different
 * placements, so they're tabs of one page now. */
export function AdminMarketingPage() {
  const [tab, setTab] = useState<Tab>('campaigns');

  const [title, setTitle] = useState('Summer Rose Latte');
  const [body, setBody] = useState('Try our floral seasonal special — member double stamps this week.');
  const [active, setActive] = useState(true);

  const [headline, setHeadline] = useState('Welcome back, City U');
  const [cta, setCta] = useState('Order ahead · earn stamps');
  const [slot, setSlot] = useState<'home-hero' | 'offers-rail'>('home-hero');
  const [live, setLive] = useState(false);

  return (
    <AdminPageShell pageId="admin-marketing" title="Marketing" hint="Customer-app creatives — publishing is simulated.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="ads">Ads &amp; banners</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <p className="form-hint">Mobile banner preview — publish requires customer app integration.</p>
          <div className="admin-page--split admin-page--split-inline">
            <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Banner title
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                Message
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
              </label>
              <label className="admin-checkbox">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Active
              </label>
              <button type="submit" className="btn-primary" disabled title="Integration pending">
                Publish (pending)
              </button>
            </form>

            <aside className="mobile-preview" aria-label="Mobile campaign preview">
              <h2 className="admin-section-title">Mobile preview</h2>
              <div className="mobile-preview__frame">
                <div className="mobile-preview__status" />
                <div className={`mobile-preview__banner ${active ? '' : 'mobile-preview__banner--inactive'}`}>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
                <div className="mobile-preview__content" />
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="ads">
          <p className="form-hint">Home-rail creatives. Publish is simulated — no customer feed is updated.</p>
          <div className="admin-page--split admin-page--split-inline">
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                setLive(true);
              }}
            >
              <label>
                Placement
                <select value={slot} onChange={(e) => setSlot(e.target.value as typeof slot)}>
                  <option value="home-hero">Home hero</option>
                  <option value="offers-rail">Offers rail</option>
                </select>
              </label>
              <label>
                Headline
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </label>
              <label>
                Call to action
                <input value={cta} onChange={(e) => setCta(e.target.value)} />
              </label>
              <button type="submit" className="btn-primary">
                Simulate publish
              </button>
              <p className="form-hint" role="status">
                {live
                  ? 'Simulated publish recorded in UI only — customer app not contacted.'
                  : 'Draft creative — not live on any device.'}
              </p>
            </form>

            <aside className="mobile-preview" aria-label="Ad placement preview">
              <h2 className="admin-section-title">Placement preview ({slot})</h2>
              <div className="mobile-preview__frame">
                <div className="mobile-preview__status" />
                <div className={`mobile-preview__banner ${live ? '' : 'mobile-preview__banner--inactive'}`}>
                  <strong>{headline}</strong>
                  <p>{cta}</p>
                </div>
                <div className="mobile-preview__content" />
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
