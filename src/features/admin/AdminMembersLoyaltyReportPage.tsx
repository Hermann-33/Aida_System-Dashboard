import { useState } from 'react';
import { FIXTURE_TODAY, PREVIEW_MEMBERS, PREVIEW_REWARD_RULES, PREVIEW_TRANSACTIONS } from '../../preview/fixtures/catalog';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'members' | 'rewards';

/** Members report and Rewards report used to be two separate pages —
 * they're both slices of the same loyalty data (who's a member, what
 * rewards got used), so they're tabs of one page now. */
export function AdminMembersLoyaltyReportPage() {
  const [tab, setTab] = useState<Tab>('members');
  const active = PREVIEW_MEMBERS.filter((m) => m.active);
  const guestOrders = 9;
  const memberOrders = 4;
  const discountRows = PREVIEW_TRANSACTIONS.filter((t) => t.discountSen > 0);

  return (
    <AdminPageShell pageId="admin-members-loyalty-report" title="Members &amp; Loyalty" hint="Sample transaction and member fixtures.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="rewards">Rewards activity</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <p className="form-hint">Member vs guest mix from preview transaction sample.</p>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Active members" value={String(active.length)} />
            <MetricCard label="Member orders (sample)" value={String(memberOrders)} />
            <MetricCard label="Guest orders (sample)" value={String(guestOrders)} />
          </div>

          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Kind</th>
                <th>Points</th>
                <th>Stamps</th>
                <th>Student status</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_MEMBERS.map((m) => (
                <tr key={m.id}>
                  <td>{m.displayName}</td>
                  <td>{m.memberCode}</td>
                  <td>{m.kind}</td>
                  <td>{m.points}</td>
                  <td>
                    {m.stamps}/{m.stampGoal}
                  </td>
                  <td>{m.studentVerification}</td>
                  <td>{m.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="rewards">
          <p className="form-hint">{PREVIEW_REWARD_RULES.note}</p>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Points issued (today)" value={String(FIXTURE_TODAY.pointsIssued)} />
            <MetricCard label="Stamps issued" value={String(FIXTURE_TODAY.stampsIssued)} />
            <MetricCard label="Redemptions" value={String(FIXTURE_TODAY.rewardRedemptions)} />
          </div>

          <h2 className="admin-section-title admin-section-title--spaced">Orders with rewards applied</h2>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Member</th>
                <th>Discount</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {discountRows.map((t) => (
                <tr key={t.order}>
                  <td>{t.order}</td>
                  <td>{t.member ?? '—'}</td>
                  <td>{formatRmFromSen(t.discountSen)}</td>
                  <td>{formatRmFromSen(t.totalSen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
