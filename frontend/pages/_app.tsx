import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { FluentProvider, teamsLightTheme } from '@fluentui/react-components';
import React from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '../lib/msalConfig';

const msalInstance = new PublicClientApplication(msalConfig as any);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MsalProvider instance={msalInstance}>
      <FluentProvider theme={teamsLightTheme}>
        <Component {...pageProps} />
      </FluentProvider>
    </MsalProvider>
  );
}
