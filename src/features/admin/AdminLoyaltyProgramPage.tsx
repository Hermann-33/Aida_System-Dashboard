import { useState } from 'react';
import { PREVIEW_MEMBERS, PREVIEW_REWARD_RULES } from '../../preview/fixtures/catalog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'rules' | 'stamps' | 'offers';

/** Loyalty rules, Stamp cards, and Offers used to be three separate pages —
 * they're all facets of the same loyalty program, so they're tabs of one
 * page now. */
export function AdminLoyaltyProgramPage() {
  const [tab, setTab] = useState<Tab>('rules');
  const offers = PREVIEW_MEMBERS.flatMap((m) =>
    m.rewards.filter((r) => r.kind === 'offer' || r.kind === 'voucher').map((r) => ({ member: m.displayName, ...r })),
  );

  return (
    <AdminPageShell pageId="admin-loyalty-program" title="Loyalty program" hint={PREVIEW_REWARD_RULES.note}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="rules">Points rules</TabsTrigger>
          <TabsTrigger value="stamps">Stamp cards</TabsTrigger>
          <TabsTrigger value="offers">Offers &amp; deals</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Earn rate</td>
                <td>RM 1 = {PREVIEW_REWARD_RULES.pointsPerRm} point</td>
              </tr>
              {PREVIEW_REWARD_RULES.vouchers.map((v) => (
                <tr key={v.label}>
                  <td>{v.label}</td>
                  <td>{v.points} points</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="stamps">
          <p className="form-hint">
            {PREVIEW_REWARD_RULES.stampsForFreeDrink} stamps = free drink · {PREVIEW_REWARD_RULES.stampsPerPurchase}{' '}
            stamp per purchase.
          </p>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Progress</th>
                <th>Free drink</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_MEMBERS.filter((m) => m.active).map((m) => (
                <tr key={m.id}>
                  <td>{m.displayName}</td>
                  <td>
                    {m.stamps}/{m.stampGoal} stamps
                  </td>
                  <td>{m.stamps >= PREVIEW_REWARD_RULES.stampsForFreeDrink ? 'Unlocked' : 'In progress'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="offers">
          <p className="form-hint">Eligibility enforced at POS when member is attached.</p>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Offer</th>
                <th>Member</th>
                <th>Expires</th>
                <th>Eligible</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={`${o.member}-${o.id}`}>
                  <td>{o.label}</td>
                  <td>{o.member}</td>
                  <td>{o.expiresOn}</td>
                  <td>{o.eligible ? 'Yes' : 'No'}</td>
                  <td>{o.rejectReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
