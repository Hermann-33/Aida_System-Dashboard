import { useState } from 'react';
import {
  PREVIEW_MEMBERS,
  PREVIEW_REWARD_RULES,
  type PreviewMember,
  type PreviewRewardOption,
} from '../../preview/fixtures/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '../../shared/components/EmptyState';

interface Props {
  member: PreviewMember | null;
  selectedRewardId: string | null;
  onSelectMember: (member: PreviewMember | null) => void;
  onApplyReward: (reward: PreviewRewardOption | null) => void;
}

export function MemberPanel({
  member,
  selectedRewardId,
  onSelectMember,
  onApplyReward,
}: Props) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');

  const results = query.trim()
    ? PREVIEW_MEMBERS.filter((m) =>
      m.displayName.toLowerCase().includes(query.toLowerCase())
        || m.memberCode.toLowerCase().includes(query.toLowerCase())
        || m.id.toLowerCase().includes(query.toLowerCase()),
    )
    : [];

  function handleSelect(m: PreviewMember) {
    if (!m.active) {
      setError('Member account is inactive. Use guest sale or contact support.');
      return;
    }
    setError('');
    onSelectMember(m);
    onApplyReward(null);
    setQuery('');
    setRewardMessage('');
  }

  async function handleScan() {
    setScanBusy(true);
    setError('');
    await new Promise((r) => setTimeout(r, 200));
    const scanned = PREVIEW_MEMBERS.find((m) => m.memberCode === 'STU-1042') ?? PREVIEW_MEMBERS[0];
    if (scanned) handleSelect(scanned);
    setScanBusy(false);
  }

  function handleApplyReward(reward: PreviewRewardOption) {
    if (!member) return;
    if (!reward.eligible) {
      setRewardMessage(reward.rejectReason || 'Reward not eligible for this member.');
      onApplyReward(null);
      return;
    }
    setRewardMessage('');
    onApplyReward(reward);
  }

  return (
    <section aria-labelledby="member-panel-title" className="max-w-xl">
      <h3 id="member-panel-title" className="font-display text-xl text-primary">
        Member / Rewards
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Scan member QR or student ID (primary). Manual lookup is fallback only. No purchase history export.
      </p>

      <Button type="button" onClick={() => void handleScan()} disabled={scanBusy} className="mt-4">
        {scanBusy ? 'Scanning…' : 'Scan member'}
      </Button>

      <p className="mt-5 text-sm font-semibold text-muted-foreground">Manual lookup (fallback)</p>
      <Label htmlFor="member-search" className="sr-only">
        Search member
      </Label>
      <Input
        id="member-search"
        type="search"
        placeholder="Name or member code…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        className="mt-2"
      />

      {query.trim() && results.length > 0 && (
        <ul role="listbox" className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-card p-1">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                onClick={() => handleSelect(m)}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {m.displayName} · {m.memberCode} · {m.kind}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {member ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <h4 className="text-lg font-bold text-foreground">{member.displayName}</h4>
          <p className="mt-2 flex flex-wrap gap-2">
            <span className="status-pill status-pill--info">{member.kind}</span>
            <span className="status-pill">{member.memberCode}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Student verification: <strong className="font-semibold text-foreground">{member.studentVerification.replace('_', ' ')}</strong>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="font-semibold text-muted-foreground">Points</dt>
              <dd>{member.points}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Stamps</dt>
              <dd>{member.stamps} / {member.stampGoal}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            Earn preview: RM 1 = {PREVIEW_REWARD_RULES.pointsPerRm} pt · +{PREVIEW_REWARD_RULES.stampsPerPurchase} stamp per
            purchase · free drink at {PREVIEW_REWARD_RULES.stampsForFreeDrink} stamps
          </p>

          <h5 className="mt-4 text-sm font-bold text-foreground">Rewards &amp; offers</h5>
          <ul className="mt-2 flex flex-col gap-2">
            {member.rewards.map((r) => (
              <li
                key={r.id}
                className={
                  selectedRewardId === r.id
                    ? 'rounded-lg border-2 border-primary bg-accent p-3'
                    : 'rounded-lg border border-border p-3'
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{r.label}</span>
                  <span className="text-xs text-muted-foreground">Exp {r.expiresOn}</span>
                </div>
                {!r.eligible && r.rejectReason && (
                  <p role="status" className="mt-1 text-xs font-semibold text-destructive">
                    {r.rejectReason}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!r.eligible}
                  onClick={() => handleApplyReward(r)}
                  className="mt-2"
                >
                  {selectedRewardId === r.id ? 'Selected' : 'Apply reward'}
                </Button>
              </li>
            ))}
          </ul>
          {rewardMessage && (
            <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
              {rewardMessage}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              onSelectMember(null);
              onApplyReward(null);
              setRewardMessage('');
            }}
          >
            Clear member
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="Guest sale" description="No member attached. Scan or search to link rewards." />
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => {
          onSelectMember(null);
          onApplyReward(null);
        }}
      >
        Continue as guest
      </Button>
    </section>
  );
}
