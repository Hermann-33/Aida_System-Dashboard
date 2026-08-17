import { describe, expect, it, vi } from 'vitest';
import { fetchAdminMembers } from './memberDirectory';

describe('fetchAdminMembers', () => {
  it('uses the trusted same-origin admin endpoint with cookie credentials', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ members: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    await expect(fetchAdminMembers(fetcher)).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/members', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('does not invent fixture data when the admin API is unavailable', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(fetchAdminMembers(fetcher)).rejects.toThrow('Unable to load members (503).');
  });

  it('rejects unauthorized directory reads', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    await expect(fetchAdminMembers(fetcher)).rejects.toThrow('Admin authorization is required');
  });
});
