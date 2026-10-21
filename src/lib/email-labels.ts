export type NotificationType = 'internal_allocation' | 'game_reminder';

export const NOTIFICATION_LABELS: Record<string, string> = {
  internal_allocation: 'Tickets allocated alert',
  game_reminder: 'Game reminder (3 days out)',
};
