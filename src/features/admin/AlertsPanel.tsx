import { useState } from 'react';
import { AlertTriangle, Bell, Check, Info, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AdminAlert {
  /** Stable identifier — needed to track read state independent of array
   * position/index, which shifts once items get marked read and re-sorted. */
  id: string;
  tag: string;
  tone: 'warn' | 'info';
  text: string;
}

interface AlertsPanelProps {
  alerts: AdminAlert[];
}

function AlertIcon({ tone }: { tone: AdminAlert['tone'] }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-medium',
        tone === 'warn' ? 'bg-[color-mix(in_srgb,var(--aida-warning)_18%,white)] text-[var(--aida-warning)]' : 'bg-[color-mix(in_srgb,var(--aida-burgundy)_14%,white)] text-[var(--aida-burgundy)]',
      )}
    >
      {tone === 'warn' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
    </div>
  );
}

/** Bell-trigger popup, same interaction shape as the shadcn
 * notification-alert-dialog reference (small AlertDialog for a quick
 * glance, "View All" opens a full slide-out drawer) — re-themed to the
 * Aida palette instead of the reference's dark/indigo theme, and rows are
 * tag + message with a tone icon instead of a person's avatar initials,
 * since these are operational alerts, not messages from teammates. */
export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const unreadCount = alerts.filter((a) => !readIds.has(a.id)).length;

  function markRead(id: string) {
    setReadIds((current) => new Set(current).add(id));
  }

  function markAllRead() {
    setReadIds(new Set(alerts.map((a) => a.id)));
  }

  function closeDrawer() {
    setDrawerOpen(false);
    document.body.classList.remove('overflow-hidden');
  }

  return (
    <>
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent"
            aria-label={`Alerts (${unreadCount} unread)`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <AlertDialogTitle>Alerts</AlertDialogTitle>
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-primary hover:bg-accent">
                  Mark all as read
                </Button>
              )}
            </div>
            <AlertDialogDescription>
              You have {unreadCount} unread {unreadCount === 1 ? 'alert' : 'alerts'}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-1 space-y-2">
            {alerts.slice(0, 2).map((alert) => {
              const isRead = readIds.has(alert.id);
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md p-3 transition-colors',
                    isRead ? 'bg-secondary' : 'bg-accent shadow-sm',
                  )}
                  onClick={() => markRead(alert.id)}
                >
                  <AlertIcon tone={alert.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{alert.tag}</p>
                    <p className="truncate text-xs text-muted-foreground">{alert.text}</p>
                  </div>
                  {!isRead && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                </div>
              );
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDrawerOpen(true);
                setDialogOpen(false);
                document.body.classList.add('overflow-hidden');
              }}
            >
              View all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-300',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeDrawer}
      >
        <div
          className={cn(
            'fixed right-0 top-0 h-full w-full max-w-md transform border-l border-border bg-card shadow-lg transition-transform duration-300 ease-in-out',
            drawerOpen ? 'translate-x-0' : 'translate-x-full',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">All alerts</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={closeDrawer} className="text-muted-foreground">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {alerts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <Bell className="mb-2 h-12 w-12 text-border" />
                  <p>No alerts</p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const isRead = readIds.has(alert.id);
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                        isRead ? 'border-border bg-card' : 'border-primary/20 bg-accent shadow-sm',
                      )}
                      onClick={() => markRead(alert.id)}
                    >
                      <AlertIcon tone={alert.tone} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{alert.tag}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{alert.text}</p>
                        {isRead && (
                          <div className="mt-2 flex items-center text-xs text-primary">
                            <Check className="mr-1 h-3 w-3" />
                            Read
                          </div>
                        )}
                      </div>
                      {!isRead && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-4">
              <Button
                className="w-full"
                onClick={() => {
                  markAllRead();
                  closeDrawer();
                }}
              >
                Mark all as read
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
