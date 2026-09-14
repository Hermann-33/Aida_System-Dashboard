import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminPageShell } from './AdminPageShell';
import {
  loadLoyaltyAdminState,
  saveLoyaltyProgram,
  saveLoyaltyReward,
  type LoyaltyAdminState,
  type LoyaltyReward,
} from '../loyalty/loyaltyClient';
import './admin.css';

export function AdminLoyaltyProgramPage() {
  const [state, setState] = useState<LoyaltyAdminState | null>(null);
  const [pointsPerRinggit, setPointsPerRinggit] = useState('1');
  const [stampGoal, setStampGoal] = useState('10');
  const [stampRewardId, setStampRewardId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const next = await loadLoyaltyAdminState();
      setState(next);
      setPointsPerRinggit(String(next.program.pointsPerRinggit));
      setStampGoal(String(next.program.stampGoal));
      setStampRewardId(next.program.stampRewardId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Loyalty configuration is unavailable');
    }
  }

  useEffect(() => { void refresh(); }, []);

  const stampRewards = useMemo(
    () => state?.rewards.filter((reward) => reward.rewardType === 'free_item' && reward.isActive) ?? [],
    [state],
  );

  async function submitProgram(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveLoyaltyProgram({
        pointsPerRinggit: Number(pointsPerRinggit),
        stampGoal: Number(stampGoal),
        stampRewardId,
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Loyalty program update failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleReward(reward: LoyaltyReward) {
    setBusy(true);
    setError(null);
    try {
      await saveLoyaltyReward({
        id: reward.id,
        code: reward.code,
        name: reward.name,
        rewardType: reward.rewardType,
        pointsCost: reward.pointsCost,
        fixedAmountSen: reward.fixedAmountSen,
        eligibleCategorySlugs: reward.eligibleCategorySlugs,
        eligibleItemSkus: reward.eligibleItemSkus,
        expiryDays: reward.expiryDays,
        isPointsRedeemable: reward.isPointsRedeemable,
        isActive: !reward.isActive,
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reward update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-loyalty-program"
      title="Loyalty program"
      hint="Live server-authoritative points, stamps and reward configuration."
    >
      {error && <p role="alert" className="form-hint">{error}</p>}
      {!state ? (
        <p className="form-hint">Loading loyalty authority…</p>
      ) : (
        <>
          <form onSubmit={submitProgram} className="admin-form-grid">
            <div>
              <Label htmlFor="points-rate">Points per RM</Label>
              <Input id="points-rate" type="number" min="0" max="100" value={pointsPerRinggit} onChange={(e) => setPointsPerRinggit(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="stamp-goal">Stamps for milestone</Label>
              <Input id="stamp-goal" type="number" min="2" max="100" value={stampGoal} onChange={(e) => setStampGoal(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="stamp-reward">Stamp reward</Label>
              <select id="stamp-reward" value={stampRewardId} onChange={(e) => setStampRewardId(e.target.value)} required>
                {stampRewards.map((reward) => <option key={reward.id} value={reward.id}>{reward.name}</option>)}
              </select>
            </div>
            <div>
              <Button type="submit" disabled={busy || !stampRewardId}>Save program</Button>
            </div>
          </form>

          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Reward</th>
                <th>Type</th>
                <th>Points</th>
                <th>Value / eligibility</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.rewards.map((reward) => (
                <tr key={reward.id}>
                  <td><strong>{reward.name}</strong><br /><span className="form-hint">{reward.code}</span></td>
                  <td>{reward.rewardType === 'fixed_amount' ? 'Fixed amount' : 'Free item'}</td>
                  <td>{reward.isPointsRedeemable ? reward.pointsCost : 'Milestone'}</td>
                  <td>
                    {reward.fixedAmountSen != null
                      ? `RM ${(reward.fixedAmountSen / 100).toFixed(2)}`
                      : [...reward.eligibleCategorySlugs, ...reward.eligibleItemSkus].join(', ') || 'Configured server-side'}
                  </td>
                  <td>{reward.expiryDays} days</td>
                  <td>{reward.isActive ? 'Active' : 'Inactive'}</td>
                  <td><Button type="button" disabled={busy} onClick={() => void toggleReward(reward)}>{reward.isActive ? 'Disable' : 'Enable'}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </AdminPageShell>
  );
}
