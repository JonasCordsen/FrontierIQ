import type { NextApiRequest, NextApiResponse } from 'next';

// Placeholder API returning a deterministic sample snapshot. Integrate with the node CLI or backend later.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    artifactType: 'current-state-snapshot',
    generatedAt: new Date().toISOString(),
    agentsOnline: 3,
    activeSessions: 12,
    licenseUtilization: { used: 120, total: 200 }
  });
}
