import { useEffect, useMemo, useState } from 'react';
import { FIXTURE_TODAY, PREVIEW_REWARD_RULES, PREVIEW_TRANSACTIONS } from '../../preview/fixtures/catalog';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import { fetchAdminMembers, type AdminMember } from './memberDirectory';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import './admin.css';

type Tab = 'members' | 'rewards';

export function AdminMembersLoyaltyReportPage() {
  const preview = isUiPreviewMode();
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(!preview);
  const [membersError, setMembersError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError(null);
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const result = await fetchAdminMembers();
        if (!cancelled) setMembers(result);
      } catch (error) {
        if (!cancelled) {
          setMembers([]);
          setMembersError(
            error instanceof Error ? error.message : 'Unable to load members.',
          );
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const activeCount = useMemo(
    () => members.filter((member) => member.isActive).length,
    [members],
  );
  const pendingStudentCount = useMemo(
    () => members.filter((member) => member.studentStatus === 'pending').length,
    [members],
  );
  const discountRows = PREVIEW_TRANSACTIONS.filter((transaction) => transaction.discountSen > 0);

  return (
    <AdminPageShell
      pageId="admin-members-loyalty-report"
      title="Members &amp; Loyalty"
      hint="Member identities come from the trusted backend. Rewards activity remains preview-only until the loyalty integration task."
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="rewards">Rewards activity</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          {preview && (
            <div className="empty-state" role="status">
              <p>Live member data requires a real AIDA Admin session. UI Preview sign-in does not authorize the live member directory.</p>
            </div>
          )}
          <p className="form-hint">
            Server-issued member identities. No points, stamps, roles, or verification outcomes are fabricated in this view.
          </p>

          {!preview && <div className="metric-grid metric-grid--compact">
            <MetricCard label="Total members" value={membersLoading ? '—' : String(members.length)} />
            <MetricCard label="Active members" value={membersLoading ? '—' : String(activeCount)} />
            <MetricCard label="Student verification pending" value={membersLoading ? '—' : String(pendingStudentCount)} />
          </div>}

          {!preview && (membersLoading ? (
            <p className="form-hint">Loading members…</p>
          ) : membersError ? (
            <p className="form-hint" role="alert">{membersError}</p>
          ) : members.length === 0 ? (
            <p className="form-hint">No members have signed up yet.</p>
          ) : (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Student status</th>
                  <th>Active</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.memberId}>
                    <td>{member.displayName ?? '—'}</td>
                    <td>{member.email}</td>
                    <td>{member.memberCode}</td>
                    <td>{member.memberType}</td>
                    <td>{member.studentStatus}</td>
                    <td>{member.isActive ? 'Yes' : 'No'}</td>
                    <td>{formatMemberDate(member.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
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
              {discountRows.map((transaction) => (
                <tr key={transaction.order}>
                  <td>{transaction.order}</td>
                  <td>{transaction.member ?? '—'}</td>
                  <td>{formatRmFromSen(transaction.discountSen)}</td>
                  <td>{formatRmFromSen(transaction.totalSen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}

function formatMemberDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(parsed);
}
