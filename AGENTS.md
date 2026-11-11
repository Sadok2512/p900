<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
- KPI module UI lives in src/components/polaris/kpi/KpiModule.tsx and receives catalogue/helpers via props from PolarisApp.jsx — avoids circular imports with the monolithic mockup file.

- Read lab data through src/lib/polaris-api resource hooks and adapters, never from UI fixtures; keeps the existing views independent of backend schemas.
- External lab authentication stays with the same-origin reverse proxy; the browser reads its role and never creates a local authority or backend.
- PolarisDataProvider owns the explicit demo mode; caches separate API/demo keys so simulations cannot silently replace real data.
- The /api/v1 relay route forwards to the lab server (POLARIS_UPSTREAM_URL); it lets the hosted preview reach the lab.
- Analyzer session verdicts, chronology and KPIs live in src/components/polaris/analyzer/analysis.ts as pure, tested rules; keeps conclusions traceable to observed messages.
- Administration tabs live in src/components/polaris/admin/; module visibility only filters navigation (never access) and Home/Administration are locked visible to prevent lockout.
