// Systeemmeldingen (alleen zolang de app open is — er is geen server)
import { dueText, relDays, relKm, todayISO } from './utils.js';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function showNotification(title, body, tag) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const opts = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' };
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) {
      await reg.showNotification(title, opts);
      return true;
    }
  } catch {
    /* val terug op de gewone Notification */
  }
  try {
    new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stuurt een melding voor elk onderhoud dat "binnenkort" of "te laat" is,
 * maximaal één keer per dag per onderhoud. Geeft de bijgewerkte 'notified'-map terug.
 */
export async function notifyDue(upcoming, notified, t, settings) {
  const today = todayISO();
  const updates = {};
  for (const u of upcoming) {
    if (u.status === 'ok') continue;
    if (notified[u.plan.id] === today) continue;
    const rel = [relDays(u.daysLeft, t), relKm(u.kmLeft, t, settings)].filter(Boolean).join(' · ');
    const ok = await showNotification(
      t('notifTitle', { item: u.item.name }),
      `${u.plan.name} — ${t('status_' + u.status)}${rel ? ` (${rel})` : ''}\n${dueText(u.plan, t, settings)}`,
      'plan-' + u.plan.id
    );
    if (ok) updates[u.plan.id] = today;
  }
  return updates;
}
