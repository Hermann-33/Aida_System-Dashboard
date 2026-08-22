import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAdminCatalogue,
  fetchPublishedCatalogue,
  saveCatalogueCategory,
  saveCatalogueItem,
  type CatalogueSnapshot,
} from '../catalogue/catalogueClient';
import { AdminMenuEditorPage } from './AdminMenuEditorPage';
import { AdminMenuPage } from './AdminMenuPage';

const runtimeMode = vi.hoisted(() => ({ preview: false }));

vi.mock('../../preview/uiPreviewMode', () => ({
  isUiPreviewMode: () => runtimeMode.preview,
}));

vi.mock('../catalogue/catalogueClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../catalogue/catalogueClient')>();
  return {
    ...original,
    fetchAdminCatalogue: vi.fn(),
    fetchPublishedCatalogue: vi.fn(),
    saveCatalogueCategory: vi.fn(),
    saveCatalogueItem: vi.fn(),
  };
});

const catalogue: CatalogueSnapshot = {
  revision: 12,
  categories: [
    { id: 'coffee', slug: 'coffee', name: 'Coffee', imageUrl: null, sortOrder: 10, isActive: true, itemCount: 2 },
  ],
  items: [
    {
      id: 'latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'LATTE', kind: 'product',
      name: 'Latte', description: 'Espresso and milk', basePriceSen: 1050, isAvailable: true, isPublished: true,
      isFeatured: false, isBestSeller: true, isStudentEligible: false, isDrink: true, imageUrl: null, volumeMl: 350,
      prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: ['oat'],
      variants: [
        { id: 'medium', code: 'medium', label: 'Medium', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
      ],
      customizationGroups: [
        {
          id: 'temperature', code: 'temperature', name: 'Temperature', sortOrder: 10,
          options: [
            { id: 'hot', code: 'hot', label: 'Hot', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
            { id: 'iced', code: 'iced', label: 'Iced', priceDeltaSen: 0, isDefault: false, isAvailable: true, sortOrder: 20 },
          ],
        },
        {
          id: 'sweetness', code: 'sweetness', name: 'Sweetness', sortOrder: 20,
          options: [
            { id: 'regular', code: 'regular', label: 'Regular', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
            { id: 'less', code: 'less-sweet', label: 'Less sweet', priceDeltaSen: 0, isDefault: false, isAvailable: true, sortOrder: 20 },
          ],
        },
      ],
    },
    {
      id: 'oat', categoryId: 'coffee', categoryName: 'Coffee', slug: 'oat', sku: 'OAT', kind: 'addon',
      name: 'Oat milk', description: '', basePriceSen: 150, isAvailable: true, isPublished: true,
      isFeatured: false, isBestSeller: false, isStudentEligible: false, isDrink: false, imageUrl: null, volumeMl: null,
      prepRoute: 'bar', sortOrder: 20, compatibleAddOnIds: [], variants: [], customizationGroups: [],
    },
  ],
};

function renderRoute(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/catalogue/menu" element={<AdminMenuPage />} />
          <Route path="/admin/catalogue/menu/:id" element={<AdminMenuEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Admin shared catalogue flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeMode.preview = false;
    vi.mocked(fetchAdminCatalogue).mockResolvedValue(catalogue);
    vi.mocked(fetchPublishedCatalogue).mockResolvedValue(catalogue);
    vi.mocked(saveCatalogueCategory).mockResolvedValue('seasonal');
    vi.mocked(saveCatalogueItem).mockResolvedValue('temporary-item');
  });

  it('uses the public live catalogue without write controls in preview mode', async () => {
    runtimeMode.preview = true;
    renderRoute('/admin/catalogue/menu');

    expect(await screen.findByText('Latte')).toBeInTheDocument();
    expect(fetchPublishedCatalogue).toHaveBeenCalledTimes(1);
    expect(fetchAdminCatalogue).not.toHaveBeenCalled();
    expect(screen.getByText(/live published catalogue in read-only mode/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Categories' }));
    expect(screen.queryByRole('button', { name: /add category/i })).not.toBeInTheDocument();
  });

  it('keeps the privileged Admin catalogue endpoint in live mode', async () => {
    renderRoute('/admin/catalogue/menu');

    expect(await screen.findByText('Latte')).toBeInTheDocument();
    expect(fetchAdminCatalogue).toHaveBeenCalledTimes(1);
    expect(fetchPublishedCatalogue).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('creates a drink item with standard customization initialization enabled', async () => {
    const user = userEvent.setup();
    renderRoute('/admin/catalogue/menu');
    await screen.findByText('Latte');

    await user.click(screen.getByRole('button', { name: /add item/i }));
    const itemDialog = screen.getByRole('dialog', { name: 'Add menu item' });
    await user.type(within(itemDialog).getByLabelText('Name'), 'Temporary Special');
    const price = within(itemDialog).getByLabelText(/base price/i);
    await user.clear(price);
    await user.type(price, '12.34');
    await user.click(within(itemDialog).getByRole('button', { name: /^add item$/i }));

    await waitFor(() => expect(saveCatalogueItem).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 'coffee',
      name: 'Temporary Special',
      basePriceSen: 1234,
      isDrink: true,
      isAvailable: true,
      isPublished: true,
      variants: [],
      compatibleAddOnIds: [],
    }), expect.anything()));
  });

  it('creates a category through the shared catalogue client', async () => {
    const user = userEvent.setup();
    renderRoute('/admin/catalogue/menu');
    await screen.findByText('Latte');

    await user.click(screen.getByRole('tab', { name: 'Categories' }));
    await user.click(screen.getByRole('button', { name: /add category/i }));
    const categoryDialog = screen.getByRole('dialog', { name: 'Add category' });
    await user.type(within(categoryDialog).getByLabelText('Name'), 'Seasonal');
    await user.click(within(categoryDialog).getByRole('button', { name: /^add category$/i }));
    await waitFor(() => expect(saveCatalogueCategory).toHaveBeenCalledWith({
      name: 'Seasonal',
      sortOrder: 20,
      isActive: true,
    }, expect.anything()));
  });

  it('edits catalogue fields, per-drink options and compatible add-ons', async () => {
    const user = userEvent.setup();
    vi.mocked(saveCatalogueItem).mockResolvedValue('latte');
    renderRoute('/admin/catalogue/menu/latte');

    const name = await screen.findByLabelText('Display name');
    expect(screen.getByRole('heading', { name: 'Drink options' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Temperature' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sweetness' })).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, 'Latte Updated');
    const price = screen.getByLabelText(/base price \(sen\)/i);
    await user.clear(price);
    await user.type(price, '1125');
    await user.click(screen.getAllByLabelText('Available')[0]!);
    await user.click(screen.getByLabelText(/published to customer\/POS/i));
    await user.click(screen.getByRole('button', { name: /add variant/i }));
    const labels = screen.getAllByLabelText('Label');
    await user.type(labels.at(-1)!, 'Large');

    const customerLabels = screen.getAllByLabelText('Customer label');
    await user.clear(customerLabels[1]!);
    await user.type(customerLabels[1]!, 'Cold');

    await user.click(screen.getByLabelText(/oat milk/i));
    await user.click(screen.getByRole('button', { name: /save catalogue item/i }));

    await waitFor(() => expect(saveCatalogueItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'latte',
      name: 'Latte Updated',
      basePriceSen: 1125,
      isAvailable: false,
      isPublished: false,
      isDrink: true,
      compatibleAddOnIds: [],
      variants: expect.arrayContaining([
        expect.objectContaining({ label: 'Medium', isDefault: true }),
        expect.objectContaining({ label: 'Large', isDefault: false }),
      ]),
      customizationOptions: expect.arrayContaining([
        expect.objectContaining({ optionValueId: 'hot', label: 'Hot', isDefault: true }),
        expect.objectContaining({ optionValueId: 'iced', label: 'Cold', isAvailable: true }),
        expect.objectContaining({ optionValueId: 'regular', label: 'Regular', isDefault: true }),
      ]),
    }), expect.anything()));
  });
});
