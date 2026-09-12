/**
 * Terminal identity is an HttpOnly cookie set by the API on OTC enrol.
 * JavaScript must never receive or read the terminal secret.
 * Use credentials: 'include' on terminal requests; probe via /api/v1/terminals/status.
 */

export type TerminalEnrolmentStatus =
  | { enrolled: true; location: TerminalLocationSummary }
  | { enrolled: false; code: string };

export type TerminalLocationSummary = {
  terminalId: string;
  terminalCode: string;
  branchId: string;
  branchCode: string;
  branchName?: string;
  salesPointId: string;
  salesPointCode: string;
  salesPointName?: string;
};

/** Probe enrolment via cookie — never reads document.cookie for the secret. */
export async function fetchTerminalStatus(): Promise<TerminalEnrolmentStatus> {
  const res = await fetch('/api/v1/terminals/status', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      enrolled: false,
      code: String(body?.code || 'TERMINAL_STATUS_UNAVAILABLE'),
    };
  }
  const data = body?.data;
  if (data?.enrolled && data?.location) {
    return {
      enrolled: true,
      location: {
        terminalId: String(data.location.terminalId),
        terminalCode: String(data.location.terminalCode),
        branchId: String(data.location.branchId),
        branchCode: String(data.location.branchCode),
        branchName: data.location.branchName ? String(data.location.branchName) : undefined,
        salesPointId: String(data.location.salesPointId),
        salesPointCode: String(data.location.salesPointCode),
        salesPointName: data.location.salesPointName
          ? String(data.location.salesPointName)
          : undefined,
      },
    };
  }
  return { enrolled: false, code: String(data?.code || 'TERMINAL_UNENROLLED') };
}



export async function enrolTerminal(
  enrolmentCode: string,
): Promise<{ ok: true; location: TerminalLocationSummary } | { ok: false; code: string; message: string }> {
  const res = await fetch('/api/v1/terminals/enrol', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: enrolmentCode.trim().toUpperCase() }),
  });
  const body = await res.json().catch(() => ({}));
  const data = body?.data;
  if (!res.ok || !data?.enrolled || !data?.location) {
    return {
      ok: false,
      code: String(body?.code || 'TERMINAL_ENROLMENT_FAILED'),
      message: String(body?.error || 'Terminal activation failed'),
    };
  }

  return {
    ok: true,
    location: {
      terminalId: String(data.location.terminalId),
      terminalCode: String(data.location.terminalCode),
      branchId: String(data.location.branchId),
      branchCode: String(data.location.branchCode),
      branchName: data.location.branchName ? String(data.location.branchName) : undefined,
      salesPointId: String(data.location.salesPointId),
      salesPointCode: String(data.location.salesPointCode),
      salesPointName: data.location.salesPointName
        ? String(data.location.salesPointName)
        : undefined,
    },
  };
}

/** Clear server-side cookie (logout/reset). */
export async function clearTerminalEnrolment(): Promise<void> {
  await fetch('/api/v1/terminals/clear-credential', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => {});
}
