import { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../../shared/components/MetricCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminPageShell } from './AdminPageShell';
import { fetchAdminMembers, type AdminMember } from './memberDirectory';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { adjustMemberLoyalty, loadMemberLoyalty, type MemberLoyaltyWallet } from '../loyalty/loyaltyClient';
import './admin.css';

type Tab = 'members' | 'rewards';

export function AdminMembersLoyaltyReportPage() {
  const preview = isUiPreviewMode();
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(!preview);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [wallet, setWallet] = useState<MemberLoyaltyWallet | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [pointsDelta, setPointsDelta] = useState('0');
  const [stampsDelta, setStampsDelta] = useState('0');
  const [reason, setReason] = useState('');
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);

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
          setMembersError(error instanceof Error ? error.message : 'Unable to load members.');
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, [preview]);

  const activeCount = useMemo(() => members.filter((member) => member.isActive).length, [members]);
  const pendingStudentCount = useMemo(() => members.filter((member) => member.studentStatus === 'pending').length, [members]);

  async function lookup(event?: React.FormEvent) {
    event?.preventDefault();
    if (!memberCode.trim()) return;
    setLoyaltyBusy(true);
    setLoyaltyError(null);
    try {
      setWallet(await loadMemberLoyalty(memberCode.trim()));
    } catch (error) {
      setWallet(null);
      setLoyaltyError(error instanceof Error ? error.message : 'Member loyalty state is unavailable.');
    } finally {
      setLoyaltyBusy(false);
    }
  }

  async function adjust(event: React.FormEvent) {
    event.preventDefault();
    setLoyaltyBusy(true);
    setLoyaltyError(null);
    try {
      const next = await adjustMemberLoyalty({
        memberCode: memberCode.trim(),
        pointsDelta: Number(pointsDelta),
        stampsDelta: Number(stampsDelta),
        reason: reason.trim(),
      });
      setWallet(next);
      setPointsDelta('0');
      setStampsDelta('0');
      setReason('');
    } catch (error) {
      setLoyaltyError(error instanceof Error ? error.message : 'Member loyalty adjustment failed.');
    } finally {
      setLoyaltyBusy(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-members-loyalty-report"
      title="Members &amp; Loyalty"
      hint="Member identity and loyalty balances come from the trusted backend. Support adjustments are audited and server-authorized."
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="rewards">Loyalty support</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          {preview && <div className="empty-state" role="status"><p>Live member data requires a real AIDA Admin session.</p></div>}
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
              <thead><tr><th>Name</th><th>Email</th><th>Code</th><th>Type</th><th>Student status</th><th>Active</th><th>Joined</th></tr></thead>
              <tbody>{members.map((member) => (
                <tr key={member.memberId}>
                  <td>{member.displayName ?? '—'}</td><td>{member.email}</td><td>{member.memberCode}</td>
                  <td>{member.memberType}</td><td>{member.studentStatus}</td><td>{member.isActive ? 'Yes' : 'No'}</td><td>{formatMemberDate(member.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          ))}
        </TabsContent>

        <TabsContent value="rewards">
          {preview ? (
            <div className="empty-state" role="status"><p>Loyalty support is disabled in UI Preview mode. No fixture balances are presented as authority.</p></div>
          ) : (
            <>
              <form onSubmit={(event) => void lookup(event)} className="admin-form-grid">
                <div><Label htmlFor="member-code">Member code</Label><Input id="member-code" value={memberCode} onChange={(event) => setMemberCode(event.target.value)} required /></div>
                <div><Button type="submit" disabled={loyaltyBusy}>Load loyalty wallet</Button></div>
              </form>
              {loyaltyError && <p className="form-hint" role="alert">{loyaltyError}</p>}
              {wallet && (
                <>
                  <div className="metric-grid metric-grid--compact">
                    <MetricCard label="Points balance" value={String(wallet.pointsBalance)} />
                    <MetricCard label="Stamp balance" value={String(wallet.stampBalance)} />
                    <MetricCard label="Active vouchers" value={String(wallet.vouchers?.length ?? 0)} />
                  </div>
                  <form onSubmit={adjust} className="admin-form-grid">
                    <div><Label htmlFor="points-delta">Points adjustment</Label><Input id="points-delta" type="number" value={pointsDelta} onChange={(event) => setPointsDelta(event.target.value)} /></div>
                    <div><Label htmlFor="stamps-delta">Stamp adjustment</Label><Input id="stamps-delta" type="number" value={stampsDelta} onChange={(event) => setStampsDelta(event.target.value)} /></div>
                    <div><Label htmlFor="adjust-reason">Reason</Label><Input id="adjust-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} required /></div>
                    <div><Button type="submit" disabled={loyaltyBusy || (!Number(pointsDelta) && !Number(stampsDelta))}>Apply audited adjustment</Button></div>
                  </form>
                </>
              )}
            </>
          )}
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
