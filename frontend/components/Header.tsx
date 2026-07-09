import React from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import SignInButton from './SignInButton';

export default function Header() {
  const isAuthenticated = useIsAuthenticated();
  const { accounts } = useMsal();
  const account = accounts && accounts.length > 0 ? accounts[0] : null;

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
      <div style={{ fontWeight: 600, fontSize: 18 }}>FrontierIQ</div>
      <div style={{ marginLeft: 'auto', color: '#666', display: 'flex', alignItems: 'center', gap: 12 }}>
        {isAuthenticated && account ? <div>{account.name}</div> : <div>Guest</div>}
        <SignInButton />
      </div>
    </header>
  );
}
