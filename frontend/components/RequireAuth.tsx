import React from 'react';
import { useIsAuthenticated } from '@azure/msal-react';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) {
    return <div>Please sign in to access this page.</div>;
  }
  return <>{children}</>;
}
