import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardFooter } from '@fluentui/react-components';

export default function Dashboard() {
  const [state, setState] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      async function loadFallbackSnapshot() {
        const fallbackRes = await fetch('/api/current-state');
        if (!fallbackRes.ok) {
          throw new Error(`Fallback snapshot failed with status ${fallbackRes.status}`);
        }
        return fallbackRes.json();
      }

      try {
        const res = await fetch('/api/protected-current-state', {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (mounted) {
            setStatusMessage(null);
            setState(json);
          }
          return;
        }

        if (mounted) {
          setStatusMessage(`Protected snapshot returned ${res.status}`);
        }
        const fallbackSnapshot = await loadFallbackSnapshot();
        if (mounted) {
          setState(fallbackSnapshot);
        }
      } catch (error) {
        console.error('Failed to fetch protected snapshot', error);
        try {
          const fallbackSnapshot = await loadFallbackSnapshot();
          if (mounted) {
            setStatusMessage('Using fallback snapshot');
            setState(fallbackSnapshot);
          }
        } catch (fallbackError) {
          console.error('Failed to fetch fallback snapshot', fallbackError);
          if (mounted) {
            setStatusMessage('Unable to load snapshot data');
            setState(null);
          }
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!state) return <div>Loading current state...</div>;

  return (
    <>
      {statusMessage ? (
        <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>{statusMessage}</div>
      ) : null}
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
          <div style={{ padding: 16, fontSize: 18 }}>
            {state?.licenseUtilization?.used ?? 0} / {state?.licenseUtilization?.total ?? 0}
          </div>
        </Card>
      </section>
    </>
  );
}
