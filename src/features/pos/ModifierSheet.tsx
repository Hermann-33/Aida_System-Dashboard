import { useEffect, useState } from 'react';
import { formatRmFromSen } from '../../shared/formatting/money';
import { Button } from '@/components/ui/button';

export type ModifierOption = {
  id: string;
  label: string;
  priceDeltaSen: number;
  available?: boolean;
  isDefault?: boolean;
};

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  help?: string;
  options: ModifierOption[];
};

interface Props {
  open: boolean;
  itemName: string;
  basePriceSen: number;
  groups: ModifierGroup[];
  onConfirm: (selections: Record<string, string[]>, unitPriceSen: number, summary: string) => void;
  onClose: () => void;
}

export function ModifierSheet({ open, itemName, basePriceSen, groups, onConfirm, onClose }: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string[]> = {};
      for (const g of groups) {
        const defaultOption = g.options.find((option) => option.isDefault && option.available !== false);
        if (defaultOption) {
          initial[g.id] = [defaultOption.id];
        } else if (g.required && g.options.find((o) => o.available !== false)) {
          initial[g.id] = [g.options.find((o) => o.available !== false)!.id];
        } else {
          initial[g.id] = [];
        }
      }
      setSelections(initial);
    }
  }, [open, groups]);

  if (!open) return null;

  function toggleOption(group: ModifierGroup, optionId: string, available: boolean) {
    if (!available) return;
    setSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.max === 1) {
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  function computePrice(): number {
    let total = basePriceSen;
    for (const g of groups) {
      const ids = selections[g.id] || [];
      for (const opt of g.options) {
        if (ids.includes(opt.id)) total += opt.priceDeltaSen;
      }
    }
    return total;
  }

  function buildSummary(): string {
    const parts: string[] = [];
    for (const g of groups) {
      const ids = selections[g.id] || [];
      const labels = g.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
      if (labels.length) parts.push(`${g.name}: ${labels.join(', ')}`);
    }
    return parts.join(' · ');
  }

  function requiredOk(): boolean {
    return groups.every((g) => {
      if (!g.required) return true;
      const n = (selections[g.id] || []).length;
      return n >= g.min && n <= g.max;
    });
  }

  const price = computePrice();

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[200] grid place-items-center bg-[var(--aida-espresso)]/60 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modifier-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
      >
        <header className="border-b border-border px-6 py-4">
          <h2 id="modifier-sheet-title" className="text-lg font-bold text-foreground">
            {itemName}
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shared catalogue options — checkout total remains an estimate
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {groups.map((group) => (
            <fieldset key={group.id} className="mb-5">
              <legend className="text-sm font-bold text-foreground">
                {group.name}
                {group.required ? ' *' : ''}
              </legend>
              {group.help && <p className="mt-1 text-xs text-muted-foreground">{group.help}</p>}
              <div className="mt-2 flex flex-col gap-2">
                {group.options.map((opt) => {
                  const available = opt.available !== false;
                  const checked = (selections[group.id] || []).includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={
                        !available
                          ? 'flex cursor-not-allowed items-center gap-3 rounded-lg border border-border p-3 opacity-50'
                          : checked
                            ? 'flex cursor-pointer items-center gap-3 rounded-lg border-2 border-primary bg-accent p-3'
                            : 'flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50'
                      }
                    >
                      <input
                        type={group.max === 1 ? 'radio' : 'checkbox'}
                        name={group.id}
                        checked={checked}
                        disabled={!available}
                        onChange={() => toggleOption(group, opt.id, available)}
                        className="h-4 w-4 accent-[var(--aida-burgundy)]"
                      />
                      <span className="flex-1 text-sm font-medium text-foreground">
                        {opt.label}
                        {!available ? ' (unavailable)' : ''}
                      </span>
                      {opt.priceDeltaSen !== 0 && (
                        <span className="text-sm font-semibold text-primary">
                          {opt.priceDeltaSen > 0 ? '+' : ''}
                          {formatRmFromSen(opt.priceDeltaSen)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <footer className="border-t border-border px-6 py-4">
          <p className="text-lg font-bold text-foreground">Item total: {formatRmFromSen(price)}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!requiredOk()}
              onClick={() => onConfirm(selections, computePrice(), buildSummary())}
            >
              Add to order
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
