# Design

The site (`frontend/`, React + Vite + TypeScript) is styled after the **HW4 Campus Customs Yale storefront**: a white page, Yale Blue, a serif/sans font pairing, and clean product-style cards. It calls the FastAPI backend through Vite's `/api` proxy.

## Visual system (`frontend/src/index.css`)

| Element | Choice | Why |
|---|---|---|
| Colors | Yale Blue `#00356b`, Intensity Blue `#286dc0`, Yale Gray, white, light blue tints; green `#1e6b3c` only for "verified" | Trust and a familiar Yale look. Green means "checked" everywhere. |
| Type | Libre Baskerville (headings), Open Sans (text) | Same pairing as HW4: the serif feels credible, the sans is easy to scan |
| Header | Serif wordmark + mic mark, 4 tabs (Find speakers · Shortlist with a count · Past searches · How it works), a 3px Yale Blue rule | Same structure as HW4's store header |
| Cards | Photo (or initials monogram on Yale Blue) on top, category eyebrow, name, title, "could speak on" line, badges, verified + fit dots | HW4's product-card pattern: the person is the "product" |
| Motion | Gentle card fade-in, floating hero cards, live progress shimmer; all turned off for people who prefer reduced motion | Feels alive without distracting |

## Pages

1. **Find speakers (home):** a hero ("Find the right voices for your conference") with illustrative preview cards, then the **brief form** overlapping the hero:
   - Step 1: theme. Step 2: Keynote / Panel / Moderator / Workshop / Open, as large choice tiles; Panel reveals panel theme and size. Step 3: the 6 category chips.
   - **More options** (folded away): conference name and type, location + reach, budget, level, priorities, skip list, notes, with character counters.
   - **"Try a real conference"** chips fill the form with YBEC, Yale Philanthropy, or the Urban Tree Summit.
   - Below the form: a 4-step "how it works" strip.
2. **Search page, while running:** a Yale Blue status bar (elapsed clock, progress bar, **Stop**), the Scout Lead's plan, **one tile per category** (Waiting → Searching → Checking → Done, with a shimmer on the active step), and a **live activity feed** in plain English.
3. **"What you searched for" box (every saved search):** under the title, an open-by-default panel showing the **categories searched** (unsearched ones are struck through, with "Only the checked categories were searched"), plus theme, looking for, panel theme and size, type, location and reach, budget, level, priorities, skipped names and notes. Added after a journalists-only test that found 0 people looked like a failed full search. Past searches also show "All 6 categories" or "Journalists & Communicators only".
4. **Search page, when done:**
   - **Stats strip:** verified speakers, categories with matches, time, tokens (% cached), cost
   - A sticky **jump bar** to each category
   - One **section per category** with a 3-column card grid
   - **Checked and filtered:** who was dropped and why, code removals, injection flags
   - **Step-by-step:** the full agent trace
   - **Suggested panels (Panel Architect)** sit above the categories, and the jump bar links to them. Each panel card has a Yale Blue header with the title and the question in italics, then members (avatar, name, category, organization, the angle they bring; click to open their profile), a moderator line, "Why they work together", "Where they'll differ", green **"shared stage"** badges, a balance note, and **Save as panel**. Older searches show a "Suggest panels" button; "Suggest different panels" re-runs it.
5. **Speaker drawer** (slides in from the right): photo or initials, name, title, Add to shortlist, Open profile, level and speaking badges. Then: could speak on (pull quote), about, why they fit, talk ideas, **has spoken before** (year + event + link), best suited for, credentials, notable work, **typed links** (profile / work / speaking), fit score with reason, topics, and "How we checked".
6. **Shortlist, organized into groups:**
   - Tabs across the top: **All saved · Unsorted · ★ Keynote speakers · one tab per panel · + New panel**, each with a live count.
   - **Drag a person onto any tab** (the tab highlights with a dashed outline), or use the **Move to** menu on each person.
   - A panel tab shows a header with the **panel name and panel theme/question, both editable in place** (click, type, Enter), plus a size hint ("add 1 more" / "good size" for 3–4 / "panels are usually 3–4") and **Delete panel**. Its people go back to Unsorted; nobody is removed.
   - The Keynote group can be renamed but not deleted.
   - Team notes on every person. **Copy as text** and **Download CSV** export the current tab, including each person's group.
7. **Past searches:** every search with its categories, location, speakers, time and tokens. Reopening one is free.
8. **How it works:** the agent diagram built from HTML boxes (brief → Scout Lead → 6 scout/verifier pairs → code checks → cards), plus 6 "what makes a result trustworthy" cards.

Footer: what the app does, the four checks every speaker passes, links, and **Start over…** (you must type "start over").

## Step 10 tweaks (from Alex's review)

- **The profile drawer opens from anywhere:** clicking a person's **name or photo/initials** on result cards, Shortlist rows, or Suggested panels opens the same slide-in profile (`lib/drawer.tsx`, a single site-wide drawer).
- **Less text on cards:** Shortlist rows no longer list links (links live only in the drawer). They show name, title, **topic tags**, and badges, plus small "Full profile · From this search · Remove" actions. Result cards show the tags right under the title, and the "could speak on" line is shortened to 2 lines.
- **Topic tags lead:** shown as blue chips on cards and **"Known for" is the first section of the drawer**. The Verifier now writes 4–6 specific tags (topic + method/sector/place, most representative first, no generic filler like "sustainability"). Example from a new search: "AI flood modeling", "soil-moisture remote sensing", "watershed thresholds".

## Step 11 tweaks

- **"Could speak on" stays on cards:** Shortlist rows show title → topic tags → the 1–2 sentence "could speak on" line → badges (links stay in the drawer). Result cards show it in up to 3 lines.
- **Location:** new searches record where each speaker is based (from their profile or organization page). It's shown with a pin under the title on result cards and in the profile drawer header. Searches saved earlier have no location.
- **Panel Architect review on Shortlist panel tabs:** right under the panel header, an "Ask the Panel Architect" box. Its review shows:
  - a **verdict** (Strong / Promising / Needs work) with a score out of 5 and a 2–3 sentence summary
  - three columns: **What works · Watch out for · What's missing**
  - **Suggested additions** from your shortlist and past searches (avatar and name open the profile; "Add to panel", "Swap in", or "Move here from Keynote speakers" with a confirm if the person is already in another group)
  - a moderator note, a **sharper theme** with a "Use this theme" button, and, when nobody in your pool fills a gap, a **suggested search** with "Start this search" (it opens the form with the theme filled in)

  "Review again" re-runs it, and the last review is saved with the panel. Other tabs show a hint pointing to panel tabs.

## Step 12: conferences as workspaces

- **Conference switcher in the header** (folder icon, "CONFERENCE / name"). Its dropdown lists every conference with counts (searches · saved · panels), plus **New conference**, **Rename this one**, and **Delete this one** (you must type the name; it deletes that conference's searches, shortlist and panels; the last conference can't be deleted). The choice is remembered in the browser.
- **Everything is filed under the current conference:**
  - New searches are saved to it, the form's foot says "Saved to [conference]", and the brief's conference name is pre-filled.
  - **Past searches** lists only this conference's searches, with a **Move to…** menu on each row to re-file one.
  - The **Shortlist** (All saved · Unsorted · Keynote · panels) is per conference, and each conference has its own Keynote group.
- **Move a panel to another conference:** a panel tab's header has a **Move to conference…** dropdown. The panel moves with all its people and their notes (if someone is already saved in the target conference, that entry is reused, so there are no duplicates). The Keynote group stays with its conference.
- **Opening a search switches to its conference** (with a short notice), so bookmarks always go to the matching shortlist. The breadcrumb shows the conference.
- **The Panel Architect review draws suggestions only from the same conference's** shortlist and past searches.
- Existing data was upgraded into a conference called **"General"**, with nothing lost. A backup was taken first (`data/scout.backup-before-conferences.db`).

## Step 13: speaker outreach tracking

- **Every shortlisted person has an Outreach strip** under their card: a color-coded **status** dropdown (Not contacted · Reached out · Following up · In conversation · Confirmed · Declined), the **first-contacted date** (recorded automatically the first time the status changes, and cleared if reset to Not contacted), the date of the last update, and **Outreach notes** (2,000 characters, saved when you click away) for replies, what they said, and next steps. These are separate from Team notes.
- A **status badge** next to each name shows where things stand at a glance.
- **Outreach filter chips** above the list show counts per status for the current tab, and clicking one filters to it.
- **Panel headers show "X of Y confirmed"** (green when the whole panel is confirmed). The Keynote header shows how many are confirmed.
- **Copy as text / Download CSV** now include outreach status, first-contacted date and outreach notes.

## Step 13b: planning-team tools

- **Profile drawer, header:** for shortlisted people, the outreach status badge, last outreach, next follow-up (highlighted if due) and owner.
- **Profile drawer, new "Planning & outreach" tab** (shows a red "!" when a follow-up is due), with these sections:
  - **Outreach status** buttons, first-contacted and last-outreach dates, **owner**, and **next follow-up date** (Overdue / Due today / Due soon flag).
  - **Confirmed speaker checklist** (appears once the status is Confirmed): bio, headshot, talk title, AV and accessibility, travel and hotel, release form, with a progress bar and count.
  - **Session:** the panel or keynote slot's name, theme, date, time and room.
  - **Fee and travel** fields.
  - **Invitation email:** "Draft invitation email" writes a personalized first email from the card, panel, session, fee and travel, with [placeholders] for anything unknown. It has Copy buttons and Redraft, and remembers your name for the sign-off. **Draft only: the app never sends email.**
  - **Outreach log:** a dated timeline of every status change and note (notes saved on the card are logged too), plus "Add to log" for new entries.
- **Shortlist cards** keep the Outreach strip and notes as before, plus small **flags** under the name: "Last outreach Oct 26 (2 days ago)", "Follow-up overdue Oct 25" (red; click to open the profile) and the owner.
- **Follow-ups due** filter chip (count of overdue or due-today follow-ups).
- **Panel and keynote headers:** editable **session date, time and room**.
- Copy and CSV exports include owner, next follow-up, last outreach, fee and travel.

## Step 14: shortlist at a glance

- **The conference switcher sits in the main header next to New search** (Alex preferred it there). A slim **conference bar** under the header shows the conference name, quick counts ("6 saved · 0 confirmed"), and a **toggle button**: "View shortlist for [conference] at a glance" on every page, which becomes "View full shortlist for [conference]" on the at-a-glance page, so you can flip between the two views.
- **At-a-glance page (`/at-a-glance`):** one clean table for the whole conference.
  - Top: totals (saved, panels, one badge per outreach status, follow-ups due).
  - **Section rows** for Keynote speakers, each panel, and "Not yet placed". **Each title is a link** that opens that panel's tab on the Shortlist (`/shortlist?tab=<id>`). Each row also shows the theme, session date/time/room, and **"X of Y confirmed"** (green when complete).
  - **Columns:** Speaker (photo + name; click to open the profile), Role & organization, Type, Outreach status, Owner, Next follow-up (red if overdue), Last outreach, and the confirmed Checklist (x/6).
  - **Copy as text** (paste into an email) and **Print**. Printing hides the site chrome and keeps the header row readable.

## Step 15: ask-about-a-speaker chat and speaker notes

- **"Ask about [name]" chat, docked at the bottom of every profile drawer** (it stays visible on both tabs, and folds away). It suggests starter questions ("What have they spoken about recently?", "Any news this year?", "Good moderator or keynote?", "A fresh talk topic?"). Answers show their **sources as links**, plus a **Save to notes** button. The conversation is kept for the browser session per speaker, so closing the drawer doesn't lose it.
- **The drawer tab is renamed "Planning, outreach & notes"** and gains a **Speaker notes** section at the bottom: notes saved from the chat (labeled "From chat", with the question asked and the source links) and notes typed by hand, each dated and deletable.
- People not on the shortlist can still be asked about; the chat just says "Save [name] to your shortlist to keep notes."

## Design rules carried over from HW5

- **One main button per screen** (Find speakers, Add to shortlist).
- **Always say what's happening and what to do next** (status bar, plain-English feed, friendly empty states).
- **Advanced options hidden until needed.**

## Responsive

The layout steps down from 3 to 2 to 1 card columns. The hero cards hide below 1080px, and the form switches to one column on phones.

## Checked in the browser (Oct 25)

- Home page, the form, chip toggles, and Moderator selection
- A **live search through the form** (progress tiles + feed), the results page, and the drawer
- Add to shortlist (header count + toast), the Shortlist page, Past searches, and How it works
- No console errors while moving between every page
- (Step 8) The brief box on a journalists-only search; a new panel renamed in place; one person dragged onto the panel tab and two moved with Move to; one moved to Keynote; the panel theme edited. Counts updated instantly and everything was saved in the database.
