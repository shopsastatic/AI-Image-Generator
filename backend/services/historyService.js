import { supabase } from '../config/supabase.js';

const TABLE = 'ai-images';
const PAGE_SIZE = 1000;
const CACHE_TTL = 60_000;

const cache = new Map();

function getCacheKey(roleKey) {
  return roleKey || 'all';
}

function getCached(roleKey) {
  const entry = cache.get(getCacheKey(roleKey));
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(roleKey, data) {
  cache.set(getCacheKey(roleKey), { data, timestamp: Date.now() });
}

export function clearHistoryCache() {
  cache.clear();
}

async function fetchPaginated(buildQuery) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function buildRoleQuery(roleFilter) {
  return () => {
    let query = supabase
      .from(TABLE)
      .select('id, data, created_at, role')
      .order('created_at', { ascending: false });

    if (roleFilter?.type === 'user') {
      query = query.eq('role', roleFilter.role);
    } else if (roleFilter?.type === 'admin' && roleFilter.roles?.length) {
      query = query.in('role', roleFilter.roles);
    }

    return query;
  };
}

function resolveRoleFilter(currentUser, roleFilterParam) {
  if (currentUser.role === 'Admin') {
    if (roleFilterParam) {
      const roles = roleFilterParam.split(',').map(r => r.trim()).filter(Boolean);
      if (roles.length > 0) {
        return { type: 'admin', roles, cacheKey: roles.slice().sort().join(',') };
      }
    }
    return { type: 'admin', roles: null, cacheKey: 'admin-all' };
  }

  const userRole = currentUser.role?.trim();
  return { type: 'user', role: userRole, cacheKey: `user:${userRole}` };
}

export async function fetchHistory(currentUser, { roleFilter, refresh = false } = {}) {
  const roleFilterConfig = resolveRoleFilter(currentUser, roleFilter);

  if (!refresh) {
    const cached = getCached(roleFilterConfig.cacheKey);
    if (cached) return cached;
  }

  const rows = await fetchPaginated(buildRoleQuery(roleFilterConfig));
  setCache(roleFilterConfig.cacheKey, rows);
  return rows;
}

export async function deleteHistorySession(sessionId) {
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: 'exact' })
    .eq('id', sessionId);

  if (error) throw error;
  clearHistoryCache();
  return (count ?? 0) > 0;
}
