import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/format';
import { useFormatLang } from '../../../lib/use-format';
import { formatDzPhoneForDisplay } from '../../../lib/phone';
import type { MemberListItem } from '../api';
import { StatusChip } from './status-chip';

export function MemberCard({ member }: { member: MemberListItem }) {
  const { t } = useTranslation();
  const lang = useFormatLang();

  return (
    <Link
      to={`/members/${member.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand-500"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold text-ink-900">
            <bdi>{member.full_name}</bdi>
          </span>
          <StatusChip status={member.status} />
          {member.owing > 0 ? (
            <span className="shrink-0 rounded-full bg-danger-600 px-2 py-0.5 text-xs font-semibold text-white">
              {t('members.owing')}
            </span>
          ) : null}
        </div>
        <span dir="ltr" className="text-sm text-ink-600">
          {formatDzPhoneForDisplay(member.phone)}
        </span>
        <span className="text-xs text-ink-400">
          {member.endDate
            ? `${t('members.expiresOn')} ${formatDate(member.endDate, lang)}`
            : t('members.noSubscription')}
          {member.sessionsRemaining !== null
            ? ` · ${t('members.sessionsLeft', { count: member.sessionsRemaining })}`
            : ''}
        </span>
      </div>
      <span className="shrink-0 text-lg text-ink-400 rtl:rotate-180" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
