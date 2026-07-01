import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Dashboard from '../components/Dashboard';

export default function Home() {
  return (
    <>
      <Head>
        <title>FrontierIQ — Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main style={{ padding: '24px' }}>
        <Dashboard />
      </main>
    </>
  );
}
