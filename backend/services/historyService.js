import { supabase } from '../config/supabase.js';

const TABLE = 'ai-images';
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Resolve the role-based row filter for the current user.
// - Admin with a roleFilter: only the selected roles.
// - Admin without a filter: all rows.
// - Non-admin: only their own role's rows.
function resolveRoleFilter(currentUser, roleFilterParam) {
  if (currentUser.role === 'Admin') {
    if (roleFilterParam) {
      const roles = roleFilterParam.split(',').map(r => r.trim()).filter(Boolean);
      if (roles.length > 0) return { type: 'admin', roles };
    }
    return { type: 'admin', roles: null };
  }

  return { type: 'user', role: currentUser.role?.trim() };
}

function applyRoleFilter(query, rf) {
  if (rf.type === 'user') return query.eq('role', rf.role);
  if (rf.type === 'admin' && rf.roles?.length) return query.in('role', rf.roles);
  return query;
}

/**
 * Fetch ONE page of history, newest first, using keyset pagination on
 * created_at (microsecond precision makes boundary ties effectively impossible;
 * the client also de-dupes by id when appending pages).
 *
 * Returns { items, nextCursor }. Pass nextCursor back as `cursor` for the next page;
 * nextCursor is null when there are no more rows.
 */
export async function fetchHistory(currentUser, { roleFilter, limit, cursor } = {}) {
  const pageSize = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
  const rf = resolveRoleFilter(currentUser, roleFilter);

  let query = supabase
    .from(TABLE)
    .select('id, data, created_at, role')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize);

  query = applyRoleFilter(query, rf);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = data || [];
  const nextCursor = items.length === pageSize ? items[items.length - 1].created_at : null;

  return { items, nextCursor };
}

export async function deleteHistorySession(sessionId) {
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: 'exact' })
    .eq('id', sessionId);

  if (error) throw error;
  return (count ?? 0) > 0;
}
