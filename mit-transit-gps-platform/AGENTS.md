<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep public Travel and Security shells at top-level routes; every private read is gated by approved-personnel RLS and every administrative write validates both role and server-issued security session.
- Store transport geometry and stops with each route and current telemetry separately; map styling is computed by route ID, never by shared coordinates.
- Keep administrator credentials server-only, use salted password derivation and constant-work comparison, and persist lockouts and versioned sessions in Cloud because workers are stateless.
- GPS service ingestion and driver delivery require real provider contracts; never synthesize telemetry or arrival estimates to fill missing integrations.

- Campus services use authenticated server functions and approved-personnel RLS; published notices/times are staff-managed in Cloud, while issue reporters can insert and read only their own reports.
- Student tracking uses an explicit opt-in database projection with a client-safe parser; never widen private fleet policies or return device/driver/security fields to this view.
- Capacitor is an HTTPS hosted evaluation shell alongside the SSR app; native packaging must not copy server output or claim offline/production readiness without a verified bundled-client strategy.
