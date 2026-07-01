import React, { useEffect, useState } from 'react';
import { useMsal, useAccount } from '@azure/msal-react';
import { loginRequest } from '../lib/msalConfig';
import { Card, CardHeader, CardFooter } from '@fluentui/react-components';

export default function Dashboard() {
  const [state, setState] = useState<any>(null);
  const { instance, accounts } = useMsal();
  const account = accounts && accounts.length > 0 ? accounts[0] : undefined;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await instance.acquireTokenSilent({ ...loginRequest, account });
        const token = response.accessToken;
        const res = await fetch('/api/protected-current-state', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (mounted) setState(json);
      } catch (e) {
        console.error('Failed to fetch protected snapshot', e);
        try {
          // fallback to unauthenticated route
          const r = await fetch('/api/current-state');
          const j = await r.json();
          if (mounted) setState(j);
        } catch { if (mounted) setState(null); }
      }
    }
    load();
    return () => { mounted = false; };
  }, [instance, accounts]);

  if (!state) return <div>Loading current state...</div>;

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <Card>
        <CardHeader>Agents Online</CardHeader>
        <div style={{ padding: 16, fontSize: 28 }}>{state?.secure?.accessAnomalies?.critical ?? '—'}</div>
        <CardFooter>Live agents: {state?.agentsOnline ?? '—'}</CardFooter>
      </Card>
      <Card>
        <CardHeader>Active Sessions</CardHeader>
        <div style={{ padding: 16, fontSize: 28 }}>{state?.activeSessions ?? '—'}</div>
      </Card>
      <Card>
        <CardHeader>License Utilization</CardHeader>
        <div style={{ padding: 16, fontSize: 18 }}>{state?.licenseUtilization?.used ?? 0} / {state?.licenseUtilization?.total ?? 0}</div>
      </Card>
    </section>
  );
}
