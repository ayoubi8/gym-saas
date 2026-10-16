import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { useMembers } from '../features/members/queries';
import { MemberCard } from '../features/members/components/member-card';
import { MemberFilters, type StatusFilter } from '../features/members/components/member-filters';

export function MembersListPage() {
  const { t } = useTranslation();
  const members = useMembers();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [owingOnly, setOwingOnly] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const digits = query.replace(/\D/g, '');
    return (members.data ?? []).filter((member) => {
      if (status !== 'all' && member.status !== status) return false;
      if (owingOnly && member.owing <= 0) return false;
      if (!query) return true;
      const nameMatch = member.full_name.toLowerCase().includes(query);
      const phoneMatch = digits.length > 0 && member.phone.includes(digits);
      return nameMatch || phoneMatch;
    });
  }, [members.data, status, search, owingOnly]);

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{t('members.title')}</h1>
          <p className="text-sm text-ink-600">
            {t('members.count', { count: members.data?.length ?? 0 })}
          </p>
        </div>
        <Link
          to="/members/new"
          className="h-11 rounded-lg bg-brand-700 px-4 font-semibold leading-[2.75rem] text-white transition hover:bg-brand-900"
        >
          {t('members.add')}
        </Link>
      </div>

      <MemberFilters
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        owingOnly={owingOnly}
        onOwingChange={setOwingOnly}
      />

      {members.isPending ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
          {t('common.loading')}
        </p>
      ) : null}

      {members.isError ? (
        <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
          {t(mapError(members.error))}
        </p>
      ) : null}

      {members.isSuccess && filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="font-semibold text-ink-900">{t('members.empty')}</p>
          <p className="mt-1 text-sm text-ink-600">{t('members.emptyHint')}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {filtered.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}
