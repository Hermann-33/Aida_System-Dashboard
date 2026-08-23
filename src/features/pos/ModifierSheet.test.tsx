import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModifierSheet, type ModifierGroup } from './ModifierSheet';

const groups: ModifierGroup[] = [{
  id: 'option:temperature',
  name: 'Temperature',
  required: true,
  min: 1,
  max: 1,
  options: [
    { id: 'hot', label: 'Hot', priceDeltaSen: 0, available: false, isDefault: false },
    { id: 'iced', label: 'Iced', priceDeltaSen: 50, available: true, isDefault: true },
  ],
}];

describe('ModifierSheet availability and defaults', () => {
  it('selects the one available default and prevents unavailable selection', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ModifierSheet
        open
        itemName="Iced latte"
        basePriceSen={1_000}
        groups={groups}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText(/Hot \(unavailable\)/i)).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Iced/i })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /add to order/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      { 'option:temperature': ['iced'] },
      1_050,
      'Temperature: Iced',
    );
  });
});
