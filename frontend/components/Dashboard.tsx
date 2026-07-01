import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [state, setState] = useState<any>(null);
  useEffect(() => {
    fetch('/api/current-state')
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state) return <div>Loading current state...</div>;

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <div style={{ padding: 16, border: '1px solid #e6e6e6', borderRadius: 8 }}>
        <h3>Agents Online</h3>
        <p style={{ fontSize: 28, margin: 0 }}>{state.agentsOnline}</p>
      </div>
      <div style={{ padding: 16, border: '1px solid #e6e6e6', borderRadius: 8 }}>
        <h3>Active Sessions</h3>
        <p style={{ fontSize: 28, margin: 0 }}>{state.activeSessions}</p>
      </div>
      <div style={{ padding: 16, border: '1px solid #e6e6e6', borderRadius: 8 }}>
        <h3>License Utilization</h3>
        <p style={{ fontSize: 18, margin: 0 }}>{state.licenseUtilization.used} / {state.licenseUtilization.total}</p>
      </div>
    </section>
  );
}
