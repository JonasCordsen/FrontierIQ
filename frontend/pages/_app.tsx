import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { FluentProvider, teamsLightTheme, webDarkTheme } from '@fluentui/react-components';
import React from 'react';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <FluentProvider theme={teamsLightTheme}>
      <Component {...pageProps} />
    </FluentProvider>
  );
}
