// Optional: Graph API integration for dynamic group lookups
// This module handles fetching user group memberships and other attributes from Microsoft Graph
// 
// Use this when you need real-time Entra group information
// For development/testing, the RBAC engine uses static config

import type { UserContext } from './types';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_TIMEOUT_MS = 5000;

/**
 * Fetch user's group memberships from Microsoft Graph
 * Requires: Groups.Read.All permission
 */
export async function getUserGroupsFromGraph(
  userId: string,
  backendToken: string
): Promise<string[]> {
  if (!backendToken) {
    console.warn('[Graph] No backend token available; skipping group lookup');
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);

    const response = await fetch(`${GRAPH_API_BASE}/me/memberOf`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Graph] Failed to fetch groups: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const groups: string[] = [];

    // Extract group IDs from the response
    for (const item of data.value || []) {
      if (item['@odata.type'] === '#microsoft.graph.group' && item.id) {
        groups.push(item.id);
      }
    }

    console.log(`[Graph] Fetched ${groups.length} groups for user ${userId}`);
    return groups;
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      console.error('[Graph] Group lookup timeout');
    } else {
      console.error('[Graph] Failed to fetch groups:', err.message);
    }
    return [];
  }
}

/**
 * Fetch user's manager from Microsoft Graph
 */
export async function getUserManagerFromGraph(
  userId: string,
  backendToken: string
): Promise<{ id: string; displayName: string } | null> {
  if (!backendToken) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);

    const response = await fetch(`${GRAPH_API_BASE}/me/manager`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // User has no manager
      }
      console.error(`[Graph] Failed to fetch manager: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      displayName: data.displayName,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[Graph] Failed to fetch manager:', err.message);
    return null;
  }
}

/**
 * Fetch user's directory roles from Microsoft Graph
 * Returns directory role IDs (e.g., "Global Admin", "User Admin")
 */
export async function getUserDirectoryRolesFromGraph(
  userId: string,
  backendToken: string
): Promise<string[]> {
  if (!backendToken) {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);

    const response = await fetch(`${GRAPH_API_BASE}/me/memberOf`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Graph] Failed to fetch directory roles: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const roles: string[] = [];

    for (const item of data.value || []) {
      if (item['@odata.type'] === '#microsoft.graph.directoryRole' && item.displayName) {
        roles.push(item.displayName);
      }
    }

    console.log(`[Graph] Fetched ${roles.length} directory roles for user ${userId}`);
    return roles;
  } catch (error) {
    const err = error as Error;
    console.error('[Graph] Failed to fetch directory roles:', err.message);
    return [];
  }
}

/**
 * Check if user is member of a specific group
 */
export async function isUserMemberOfGroupGraph(
  userId: string,
  groupId: string,
  backendToken: string
): Promise<boolean> {
  if (!backendToken) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);

    const response = await fetch(
      `${GRAPH_API_BASE}/me/memberOf/microsoft.graph.group?$filter=id eq '${groupId}'`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${backendToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Graph] Failed to check group membership: ${response.status}`);
      return false;
    }

    const data = await response.json();
    return (data.value?.length || 0) > 0;
  } catch (error) {
    const err = error as Error;
    console.error('[Graph] Failed to check group membership:', err.message);
    return false;
  }
}

/**
 * Enrich user context with data from Microsoft Graph
 * Adds real-time group memberships and directory roles
 */
export async function enrichUserContextWithGraph(
  userContext: UserContext,
  backendToken: string
): Promise<UserContext> {
  if (!backendToken) {
    console.warn('[Graph] No backend token; skipping context enrichment');
    return userContext;
  }

  try {
    // Fetch groups from Graph
    const graphGroups = await getUserGroupsFromGraph(userContext.userId, backendToken);
    const enrichedGroups = Array.from(new Set([...userContext.groupIds, ...graphGroups]));

    // Fetch directory roles
    const directoryRoles = await getUserDirectoryRolesFromGraph(userContext.userId, backendToken);
    const isGlobalAdmin = directoryRoles.includes('Global Administrator');

    return {
      ...userContext,
      groupIds: enrichedGroups,
      isGlobalAdmin: userContext.isGlobalAdmin || isGlobalAdmin,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[Graph] Failed to enrich user context:', err.message);
    return userContext;
  }
}

/**
 * Health check: verify Graph API connectivity
 */
export async function checkGraphConnectivity(backendToken: string): Promise<boolean> {
  if (!backendToken) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);

    const response = await fetch(`${GRAPH_API_BASE}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${backendToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Batch operation: enrich multiple user contexts with Graph data
 */
export async function enrichMultipleUserContexts(
  userContexts: UserContext[],
  backendToken: string
): Promise<UserContext[]> {
  if (!backendToken) {
    return userContexts;
  }

  // Check Graph connectivity first
  const isConnected = await checkGraphConnectivity(backendToken);
  if (!isConnected) {
    console.warn('[Graph] Graph API is not accessible; skipping enrichment');
    return userContexts;
  }

  // Enrich all contexts in parallel
  const enriched = await Promise.all(
    userContexts.map((ctx) => enrichUserContextWithGraph(ctx, backendToken))
  );

  return enriched;
}
