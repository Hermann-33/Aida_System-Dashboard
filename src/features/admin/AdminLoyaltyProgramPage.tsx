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

type RewardDraft = {
  id?: string;
  code: string;
  name: string;
  rewardType: 'fixed_amount' | 'free_item';
  pointsCost: string;
  fixedAmountSen: string;
  eligibleCategorySlugs: string;
  eligibleItemSkus: string;
  expiryDays: string;
  isPointsRedeemable: boolean;
  isActive: boolean;
};

const EMPTY_REWARD: RewardDraft = {
  code: '',
  name: '',
  rewardType: 'fixed_amount',
  pointsCost: '0',
  fixedAmountSen: '',
  eligibleCategorySlugs: '',
  eligibleItemSkus: '',
  expiryDays: '30',
  isPointsRedeemable: true,
  isActive: true,
};

function rewardDraft(reward: LoyaltyReward): RewardDraft {
  return {
    id: reward.id,
    code: reward.code,
    name: reward.name,
    rewardType: reward.rewardType,
    pointsCost: String(reward.pointsCost),
    fixedAmountSen: reward.fixedAmountSen == null ? '' : String(reward.fixedAmountSen),
    eligibleCategorySlugs: reward.eligibleCategorySlugs.join(', '),
    eligibleItemSkus: reward.eligibleItemSkus.join(', '),
    expiryDays: String(reward.expiryDays),
    isPointsRedeemable: reward.isPointsRedeemable,
    isActive: reward.isActive,
  };
}

function list(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

export function AdminLoyaltyProgramPage() {
  const [state, setState] = useState<LoyaltyAdminState | null>(null);
  const [pointsPerRinggit, setPointsPerRinggit] = useState('1');
  const [stampGoal, setStampGoal] = useState('10');
  const [stampRewardId, setStampRewardId] = useState('');
  const [draft, setDraft] = useState<RewardDraft>(EMPTY_REWARD);
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

  async function persistReward(reward: RewardDraft) {
    setBusy(true);
    setError(null);
    try {
      await saveLoyaltyReward({
        id: reward.id ?? '',
        code: reward.code.trim(),
        name: reward.name.trim(),
        rewardType: reward.rewardType,
        pointsCost: Number(reward.pointsCost),
        fixedAmountSen: reward.rewardType === 'fixed_amount' ? Number(reward.fixedAmountSen) : null,
        eligibleCategorySlugs: list(reward.eligibleCategorySlugs),
        eligibleItemSkus: list(reward.eligibleItemSkus),
        expiryDays: Number(reward.expiryDays),
        isPointsRedeemable: reward.isPointsRedeemable,
        isActive: reward.isActive,
      });
      setDraft(EMPTY_REWARD);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reward update failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitReward(event: React.FormEvent) {
    event.preventDefault();
    await persistReward(draft);
  }

  async function toggleReward(reward: LoyaltyReward) {
    await persistReward({ ...rewardDraft(reward), isActive: !reward.isActive });
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
            <div><Button type="submit" disabled={busy || !stampRewardId}>Save program</Button></div>
          </form>

          <h3 className="mt-8 text-lg font-semibold">Reward catalogue</h3>
          <form onSubmit={submitReward} className="admin-form-grid mt-3">
            <div><Label htmlFor="reward-code">Code</Label><Input id="reward-code" value={draft.code} onChange={(e) => setDraft((v) => ({ ...v, code: e.target.value }))} required /></div>
            <div><Label htmlFor="reward-name">Name</Label><Input id="reward-name" value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} required /></div>
            <div>
              <Label htmlFor="reward-type">Type</Label>
              <select id="reward-type" value={draft.rewardType} onChange={(e) => setDraft((v) => ({ ...v, rewardType: e.target.value as RewardDraft['rewardType'] }))}>
                <option value="fixed_amount">Fixed amount</option><option value="free_item">Free item</option>
              </select>
            </div>
            <div><Label htmlFor="reward-cost">Points cost</Label><Input id="reward-cost" type="number" min="0" value={draft.pointsCost} onChange={(e) => setDraft((v) => ({ ...v, pointsCost: e.target.value }))} required /></div>
            {draft.rewardType === 'fixed_amount' && <div><Label htmlFor="reward-value">Value (sen)</Label><Input id="reward-value" type="number" min="1" value={draft.fixedAmountSen} onChange={(e) => setDraft((v) => ({ ...v, fixedAmountSen: e.target.value }))} required /></div>}
            <div><Label htmlFor="reward-categories">Eligible category slugs</Label><Input id="reward-categories" placeholder="drinks, pastries" value={draft.eligibleCategorySlugs} onChange={(e) => setDraft((v) => ({ ...v, eligibleCategorySlugs: e.target.value }))} /></div>
            <div><Label htmlFor="reward-skus">Eligible item SKUs</Label><Input id="reward-skus" placeholder="SKU-001, SKU-002" value={draft.eligibleItemSkus} onChange={(e) => setDraft((v) => ({ ...v, eligibleItemSkus: e.target.value }))} /></div>
            <div><Label htmlFor="reward-expiry">Expiry days</Label><Input id="reward-expiry" type="number" min="1" value={draft.expiryDays} onChange={(e) => setDraft((v) => ({ ...v, expiryDays: e.target.value }))} required /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isPointsRedeemable} onChange={(e) => setDraft((v) => ({ ...v, isPointsRedeemable: e.target.checked }))} /> Points redeemable</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((v) => ({ ...v, isActive: e.target.checked }))} /> Active</label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{draft.id ? 'Save reward' : 'Create reward'}</Button>
              {draft.id && <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(EMPTY_REWARD)}>Cancel edit</Button>}
            </div>
          </form>

          <table className="data-table admin-table mt-6">
            <thead><tr><th>Reward</th><th>Type</th><th>Points</th><th>Value / eligibility</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {state.rewards.map((reward) => (
                <tr key={reward.id}>
                  <td><strong>{reward.name}</strong><br /><span className="form-hint">{reward.code}</span></td>
                  <td>{reward.rewardType === 'fixed_amount' ? 'Fixed amount' : 'Free item'}</td>
                  <td>{reward.isPointsRedeemable ? reward.pointsCost : 'Milestone'}</td>
                  <td>{reward.fixedAmountSen != null ? `RM ${(reward.fixedAmountSen / 100).toFixed(2)}` : [...reward.eligibleCategorySlugs, ...reward.eligibleItemSkus].join(', ') || 'Configured server-side'}</td>
                  <td>{reward.expiryDays} days</td><td>{reward.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(rewardDraft(reward))}>Edit</Button><Button type="button" disabled={busy} onClick={() => void toggleReward(reward)}>{reward.isActive ? 'Disable' : 'Enable'}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </AdminPageShell>
  );
}
