// Default reminder templates created with every new gym (AR + FR).
// Bodies use the variables {memberName} {endDate} {gymName} (AGENTS.md §5.8).

export interface DefaultTemplate {
  language: 'ar' | 'fr';
  kind: 'before_expiry' | 'expiry_day';
  body: string;
}

export const DEFAULT_REMINDER_TEMPLATES: DefaultTemplate[] = [
  {
    language: 'ar',
    kind: 'before_expiry',
    body: 'مرحبًا {memberName}، سينتهي اشتراكك في {gymName} يوم {endDate}. يرجى التجديد.',
  },
  {
    language: 'fr',
    kind: 'before_expiry',
    body: 'Cher {memberName}, votre abonnement à {gymName} expire le {endDate}. Veuillez renouveler.',
  },
  {
    language: 'ar',
    kind: 'expiry_day',
    body: 'مرحبًا {memberName}، ينتهي اشتراكك في {gymName} اليوم {endDate}. جدّده الآن.',
  },
  {
    language: 'fr',
    kind: 'expiry_day',
    body: 'Bonjour {memberName}, votre abonnement à {gymName} expire aujourd\'hui ({endDate}). Renouvelez-le maintenant.',
  },
];
