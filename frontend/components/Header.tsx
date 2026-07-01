import React from 'react';
import { FluentProvider, tokens } from '@fluentui/react-components';

export default function Header() {
  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
      <div style={{ fontWeight: 600, fontSize: 18 }}>FrontierIQ</div>
      <div style={{ marginLeft: 'auto', color: '#666' }}>Admin Console</div>
    </header>
  );
}
