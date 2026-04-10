# SignalStack Frontend

## Files

- `/Users/kevanlee/Desktop/software20/index.html`: semantic homepage with inline comments
- `/Users/kevanlee/Desktop/software20/home.css`: very small homepage stylesheet
- `/Users/kevanlee/Desktop/software20/scan-setup.html`: setup step 1
- `/Users/kevanlee/Desktop/software20/scan-competitors.html`: setup step 2
- `/Users/kevanlee/Desktop/software20/scan-loading.html`: loading state
- `/Users/kevanlee/Desktop/software20/results.html`: dashboard
- `/Users/kevanlee/Desktop/software20/social-preview.html`: share preview
- `/Users/kevanlee/Desktop/software20/app.css`: shared styles for all non-home pages
- `/Users/kevanlee/Desktop/software20/main.js`: state + fake data + dashboard rendering

## How to edit quickly

- Change homepage copy directly in `/Users/kevanlee/Desktop/software20/index.html`
- Use the comments in `/Users/kevanlee/Desktop/software20/index.html` as the editing guide for each section
- Change colors in the `:root` block at the top of `/Users/kevanlee/Desktop/software20/home.css` or `/Users/kevanlee/Desktop/software20/app.css`.
- Change spacing by editing `padding` on `.page-section`, `.panel`, and the header/footer blocks.
- Change layout by editing these grid classes in `/Users/kevanlee/Desktop/software20/app.css`:
  - `.site-header`
  - `.grid-2`
  - `.dashboard-hero`
  - `.kpi-grid`

## Layout primitives

The shared app pages mostly use a few classes:

- `page-section`: one horizontal band on the page
- `panel`: a bordered content box inside a section
- `stack`: vertical spacing between children
- `grid-2`: two-column layout
- `button`: default button style

The homepage has its own small set of classes in `/Users/kevanlee/Desktop/software20/home.css`, and the HTML is commented so you can quickly find the hero, cards, columns, and footer.

## JavaScript hooks

`/Users/kevanlee/Desktop/software20/main.js` depends on certain IDs and attributes.
If you rename these, the prototype will break:

- Forms: `google-auth-form`, `competitor-form`
- Inputs: `company-name`, `company-url`, `.competitor-input`, `input[name="mock-account"]`
- Dashboard IDs: `overall-score`, `overall-rank`, `summary-copy`, `headline-text`, `insight-copy`, `notes-copy`
- Dashboard containers: `kpi-grid`, `leaderboard`, `channel-list`, `review-grid`, `llm-grid`
- Charts: `trend-chart`, `trend-legend`, `awareness-chart`, `awareness-legend`, `sov-chart`, `sov-legend`
- Tabs: `data-tab-target`, `data-tab-panel`

## Simplification notes

- The old large shared `style.css` file is gone.
- The homepage is isolated so changes there do not affect the dashboard pages.
- The dashboard is still the most complex page because `main.js` populates a lot of it dynamically.
