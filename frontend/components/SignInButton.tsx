import React from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../lib/msalConfig';

export default function SignInButton() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => console.error(e));
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((e) => console.error(e));
  };

  return (
    <div>
      <button onClick={handleLogin} style={{ marginRight: 8 }}>Sign in</button>
      <button onClick={handleLogout}>Sign out</button>
    </div>
  );
}
