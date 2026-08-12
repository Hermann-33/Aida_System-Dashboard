import { employeeFetch } from '../../auth/employeeSession';

export type AdminMember = {
  memberId: string;
  userId: string;
  memberCode: string;
  displayName: string | null;
  email: string;
  memberType: 'standard' | 'student' | 'staff';
  studentStatus: 'not_submitted' | 'pending' | 'verified' | 'rejected' | 'expired';
  isActive: boolean;
  createdAt: string;
};

type MemberDirectoryPayload = {
  members: AdminMember[];
};

type MemberFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Reads the admin member directory through the trusted same-origin API.
 *
 * The browser never receives a Supabase service key and never falls back to a
 * fixture. The BFF authenticates the HttpOnly employee session and executes
 * the admin-only member-directory RPC with that caller's JWT, preserving RLS.
 */
export async function fetchAdminMembers(
  fetcher: MemberFetcher = employeeFetch,
): Promise<AdminMember[]> {
  const response = await fetcher('/api/v1/admin/members', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Admin authorization is required to load members.');
    }
    throw new Error(`Unable to load members (${response.status}).`);
  }

  const payload = (await response.json()) as Partial<MemberDirectoryPayload>;
  if (!Array.isArray(payload.members)) {
    throw new Error('Member directory response is invalid.');
  }

  return payload.members;
}
