import { LogLevel } from '@azure/msal-browser';

const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common';
const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '';
const redirectUri = process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI || 'http://localhost:3000';

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string) => {
        // simple logger
        console.log(level, message);
      },
      logLevel: LogLevel.Info,
      piiLoggingEnabled: false
    }
  }
};

export const loginRequest = {
  scopes: ["User.Read"]
};
