// Extension: backlog-board
// FrontierIQ backlog viewer and filter canvas.
// Displays GitHub issues from the FrontierIQ repo, filtered by pillar and status.

import { createServer } from "node:http";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const servers = new Map();

function renderHtml(instanceId) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FrontierIQ Backlog</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 1rem;
        background: var(--background-color-default, #ffffff);
        color: var(--text-color-default, #1f2328);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        font-size: var(--text-body-medium, 14px);
        line-height: var(--leading-body-medium, 20px);
      }
      h1 {
        font-size: var(--text-title-large, 26px);
        font-weight: var(--font-weight-semibold, 600);
        margin: 0 0 1rem 0;
      }
      .filters {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      input, select {
        padding: 0.5rem;
        border: 1px solid var(--border-color-default, #d0d7de);
        border-radius: 4px;
        background: var(--background-color-default, #ffffff);
        color: var(--text-color-default, #1f2328);
        font-family: inherit;
        font-size: inherit;
      }
      button {
        padding: 0.5rem 1rem;
        background: var(--color-focus-outline, #0969da);
        color: var(--color-white, #ffffff);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
      }
      button:hover {
        opacity: 0.85;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
      }
      th, td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--border-color-default, #d0d7de);
      }
      th {
        background: var(--background-color-muted, #f6f8fa);
        font-weight: var(--font-weight-semibold, 600);
      }
      tr:hover {
        background: var(--background-color-muted, #f6f8fa);
      }
      .issue-title {
        font-weight: 500;
        color: var(--color-focus-outline, #0969da);
      }
      .label {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        background: var(--true-color-blue-muted, #ddf4ff);
        color: var(--true-color-blue, #0969da);
        border-radius: 2px;
        font-size: 0.75rem;
        margin-right: 0.25rem;
      }
      .loading {
        color: var(--text-color-muted, #656d76);
      }
    </style>
  </head>
  <body>
    <h1>FrontierIQ Backlog</h1>
    <div class="filters">
      <input type="text" id="search" placeholder="Search issues..." />
      <select id="pillar">
        <option value="">All Pillars</option>
        <option value="observe">OBSERVE</option>
        <option value="govern">GOVERN</option>
        <option value="secure">SECURE</option>
        <option value="optimize">OPTIMIZE</option>
      </select>
      <select id="label">
        <option value="">All Labels</option>
        <option value="backlog">backlog</option>
        <option value="in-progress">in-progress</option>
        <option value="done">done</option>
      </select>
      <button id="refresh">Refresh</button>
    </div>
    <div id="content" class="loading">Loading issues...</div>
    <script>
      const instanceId = "${instanceId}";
      let allIssues = [];

      async function fetchIssues() {
        try {
          const response = await fetch(\`/issues\`);
          const data = await response.json();
          allIssues = data.issues || [];
          renderIssues();
        } catch (error) {
          document.getElementById('content').innerHTML = \`<p style="color: red;">Error: \${error.message}</p>\`;
        }
      }

      function renderIssues() {
        const search = document.getElementById('search').value.toLowerCase();
        const pillar = document.getElementById('pillar').value;
        const label = document.getElementById('label').value;

        let filtered = allIssues.filter(issue => {
          const matchesSearch = !search || issue.title.toLowerCase().includes(search) || issue.number.toString().includes(search);
          const matchesPillar = !pillar || (issue.labels && issue.labels.some(l => l.toLowerCase().includes(pillar)));
          const matchesLabel = !label || (issue.labels && issue.labels.some(l => l.toLowerCase() === label));
          return matchesSearch && matchesPillar && matchesLabel;
        });

        if (filtered.length === 0) {
          document.getElementById('content').innerHTML = '<p class="loading">No issues match the filters.</p>';
          return;
        }

        const table = \`
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Title</th>
                <th>Labels</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              \${filtered.map(issue => \`
                <tr>
                  <td><a href="\${issue.url}" target="_blank">#\${issue.number}</a></td>
                  <td class="issue-title">\${issue.title.substring(0, 60)}\${issue.title.length > 60 ? '...' : ''}</td>
                  <td>\${(issue.labels || []).map(l => \`<span class="label">\${l}</span>\`).join('')}</td>
                  <td>\${issue.state}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
        document.getElementById('content').innerHTML = table;
      }

      document.getElementById('search').addEventListener('input', renderIssues);
      document.getElementById('pillar').addEventListener('change', renderIssues);
      document.getElementById('label').addEventListener('change', renderIssues);
      document.getElementById('refresh').addEventListener('click', fetchIssues);

      fetchIssues();
    </script>
  </body>
</html>`;
}

async function startServer(instanceId) {
    const server = createServer(async (req, res) => {
        if (req.url === "/issues" && req.method === "GET") {
            // Fetch issues from GitHub API
            try {
                const response = await fetch("https://api.github.com/repos/JonasCordsen/FrontierIQ/issues?state=all&per_page=100");
                if (response.status === 404) {
                    // Private repo — cannot access via public API
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
                    res.end(JSON.stringify({
                        issues: [],
                        note: "FrontierIQ is a private repository. To view issues, authenticate with GitHub (gh auth login) or use 'gh issue list' in the repo directory.",
                    }));
                    return;
                }
                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }
                const issues = await response.json();
                const formatted = issues.map(issue => ({
                    number: issue.number,
                    title: issue.title,
                    url: issue.html_url,
                    state: issue.state,
                    labels: issue.labels ? issue.labels.map(l => l.name) : [],
                }));
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ issues: formatted }));
            } catch (error) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: error.message }));
            }
        } else {
            // Serve main HTML
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderHtml(instanceId));
        }
    });
    // Port 0 = let the OS pick a free ephemeral port. Bind to loopback only.
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "backlog-board",
            displayName: "FrontierIQ Backlog Board",
            description: "View, filter, and manage FrontierIQ backlog issues by pillar, label, and status.",
            actions: [
                {
                    name: "refresh",
                    description: "Refresh the backlog to fetch latest issues from GitHub.",
                    handler: async (ctx) => {
                        return { ok: true, message: "Refresh triggered" };
                    },
                },
                {
                    name: "filter_by_pillar",
                    description: "Filter backlog items by pillar (observe, govern, secure, optimize).",
                    inputSchema: {
                        type: "object",
                        properties: {
                            pillar: { type: "string", enum: ["observe", "govern", "secure", "optimize"] },
                        },
                        required: ["pillar"],
                    },
                    handler: async (ctx) => {
                        return { ok: true, pillar: ctx.input.pillar };
                    },
                },
                {
                    name: "get_summary",
                    description: "Get a summary of backlog items by status and pillar.",
                    handler: async (ctx) => {
                        try {
                            const response = await fetch("https://api.github.com/repos/JonasCordsen/FrontierIQ/issues?state=all&per_page=100");
                            if (!response.ok) {
                                // Private repo — return a helpful message
                                return {
                                    note: "Private repo — cannot fetch via public GitHub API. View the backlog board in the canvas panel or use the CLI.",
                                    repo: "JonasCordsen/FrontierIQ",
                                    instructions: "Run 'gh issue list' in the repo to see all issues.",
                                };
                            }
                            const issues = await response.json();
                            if (!Array.isArray(issues)) {
                                return { error: "Unexpected API response format" };
                            }
                            const summary = {
                                total: issues.length,
                                open: issues.filter(i => i.state === "open").length,
                                closed: issues.filter(i => i.state === "closed").length,
                                by_pillar: {
                                    observe: issues.filter(i => i.labels && i.labels.some(l => l.name.toLowerCase().includes("observe"))).length,
                                    govern: issues.filter(i => i.labels && i.labels.some(l => l.name.toLowerCase().includes("govern"))).length,
                                    secure: issues.filter(i => i.labels && i.labels.some(l => l.name.toLowerCase().includes("secure"))).length,
                                    optimize: issues.filter(i => i.labels && i.labels.some(l => l.name.toLowerCase().includes("optimize"))).length,
                                },
                            };
                            return summary;
                        } catch (error) {
                            return {
                                note: "Could not fetch issues from GitHub API.",
                                error: error.message,
                                instructions: "Use the canvas panel's 'Refresh' button or run 'gh issue list' to view backlog.",
                            };
                        }
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: "FrontierIQ Backlog Board",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
