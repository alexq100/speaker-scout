# frontend/

React + Vite + TypeScript site in the HW4 Yale look. Started by `../start.sh` (or `npm run dev` with the API on port 8000). Design notes: [`docs/design.md`](../docs/design.md).

| Path | What it holds |
|---|---|
| `src/main.tsx`, `src/App.tsx` | Entry point, fonts, routes, shortlist + toast providers |
| `src/index.css` | The whole visual system (colors, type, cards, drawer, responsive) |
| `src/lib/` | `api.ts` (backend client), `types.ts` (mirrors `backend/models.py`), `labels.ts`, `format.ts`, `shortlist.tsx` (shared shortlist state) |
| `src/components/` | `NavBar`, `SiteFooter`, `BriefForm`, `RunProgress`, `ResultsView`, `SpeakerCard`, `SpeakerDrawer`, `ChecksPanel`, `SaveButton`, `SpeakerBadges`, `Avatar`, `Icons`, `Toast` |
| `src/pages/` | `Home`, `SearchPage`, `Shortlist`, `History`, `HowItWorks`, `NotFound` |
