# Design-system review

Date: 28 October 2026. Scope: revised Ledger draft following the user's instruction to use the screenshot only as inspiration.

**Status: draft, delivery gate incomplete.** Antislop core, UI, copywriting, human accessibility and responsive-layout rules remain active in `during` mode. [DESIGN.md](../DESIGN.md) now rejects using the screenshot as a composition template.

## Current revision checks

- Source syntax PASS: Node `--check design-system/preview.js` completed with exit code 0.
- HTML structure PASS: parser found balanced elements and 40 unique ids.
- Token contrast PASS: 50 light/dark semantic pairs checked using the WCAG luminance formula. Minimum text contrast 5.191:1; minimum control contrast 3.160:1. This is a token check, not a rendered accessibility audit.
- Hard Gate incomplete: revised layouts, keyboard behavior, every control and both rendered themes still need browser checks (R-03, R-32, R-34, R-35, R-39).
- Purpose-Gate source review: colors, navigation, filters, typography, selection and motion have reasons in DESIGN.md. No new image, logo or avatar was created.
- Liveliness source review: dials declared before edits; the stock table is the focal point, quantity order is the repeated motif, and teal identifies the primary transaction. Visual confirmation is pending.
- Craftsmanship and Quality Locks incomplete: the composition and copy changed; resilience and functional completeness require a permitted browser session. The draft is not approved for delivery.

Everything below records the superseded close-reference prototype. Its screenshot and click-through evidence do not verify this revision.

## Evidence and limits

The superseded desktop screen was rendered in Chrome and visually inspected. It shows the horizontal navigation, compact toolbar, location tree, cyan selection, numeric columns and inline actions. [Historical render](qa/erp-desktop.png).

The first file-based browser run reached the CSV export check, where download completion was canceled. A loopback browser attempt then returned `ERR_NETWORK_ACCESS_DENIED`; Browser Use could not reach the loopback preview and explicitly rejected the local file protocol. Browser verification stopped after that policy rejection. The temporary preview server was stopped.

[Browser-attempt evidence](qa/browser-attempt.json) records the limitation. [Static-check results](qa/static-checks.json) separately record syntax, semantic color pairs, asset references, IDs and document links. Static checks do not prove keyboard, responsive layout, download completion or transaction behavior.

Production UAT, authentication, authorization, database transactions, ERP delivery, scanner hardware, mobile keyboard behavior and a full accessibility assessment have not been performed.

## Copy review

The interface uses operational labels: Penerimaan, Reservasi, Fisik, Komitmen, Bebas, Karantina and Kartu stok. Pending capture differs from an unknown confirmation outcome. Quarantine keeps physical stock and commitment visible while preventing new allocation. All examples state that their data and actions are simulated.

No client names, avatars, notifications, testimonials, customer counts or performance claims were created. The example furniture products and references are simulation data. Automatic replenishment was not added to the accepted product scope merely because it appears in the reference screenshot.

## Antislop gate: hard rules

PASS below is limited to the stated source or evidence. Pending checks prevent this prototype from being described as a fully verified release.

| Item | Status | Evidence / scope |
|---|---|---|
| R-02, copy and punctuation | Source checked | Authored text uses direct operational labels; static checks reject long dashes and broken characters |
| R-03, responsive layout | Pending browser verification | Source defines desktop, intermediate and narrow record layouts; final width/zoom suite did not complete |
| R-17, numbers | PASS source | Quantities and counts use a labeled simulation dataset; selected and filtered counts derive from that data |
| R-18, testimonials | PASS source | No testimonials or invented people |
| R-23, visual assets | PASS source | User supplied the reference; product name remains text; no copied brand logo or avatar |
| R-24, navigation | Source checked | Every module maps to an implemented preview view; local asset/document paths are checked separately |
| R-25, contrast | Static measurement | Semantic foreground/background pairs are measured; actual rendered states still need a complete browser review |
| R-26, controls | Partial browser evidence | Local behaviors are implemented; CSV completion and the full click-through remain unverified |
| R-27, UI states | Source checked | Search-empty, loading, error, pending and unknown outcome have distinct copy and recovery controls |
| R-28, FAQ | PASS source | No filler FAQ |
| R-32, keyboard | Pending browser verification | Native controls, dialog focus handling and search shortcut are implemented; full current-reference keyboard suite is incomplete |
| R-33, source editing | PASS source | Features were authored in the HTML/CSS/JS files; QA scripts are separate |
| R-34, themes | Pending browser verification | Light and dark semantic roles exist and their token contrast is measured; full theme interaction checks remain open |
| R-35, execution and click-through | Incomplete | Initial render exists; browser policy prevented the complete verification suite |
| R-36, security and performance claims | PASS source | Prototype does not claim ISO conformity, production security or measured application capacity |
| R-37, direction | PASS source | Supplied ERP screenshot and Ledger tone are recorded in DESIGN.md; earlier proposals are superseded |
| R-38, honest content | PASS source | Data and actions are labeled simulation; product and device validation remain open |

## Antislop gate: purpose of visual techniques

| Item | Status | Purpose / evidence |
|---|---|---|
| R-01, color and gradients | PASS source | Plum identifies transaction actions; teal identifies selection/references; no gradient or glow |
| R-04, icons | PASS source | Text labels and native controls carry actions; no decorative icon library |
| R-06, typography | PASS source | Segoe UI serves workstation reading; quantities use tabular figures |
| R-07, background | PASS source | Plain surfaces preserve table contrast; no decorative grid |
| R-08, arrows | PASS source | Sort and pagination marks identify actual direction changes |
| R-09, badges | PASS source | Quality labels denote real states within the simulated dataset |
| R-10, glass | Not used | No glass effects |
| R-12, shadow | Not used | Panels use rules and boundaries |
| R-13, glow | Not used | No glowing surfaces or indicators |
| R-14, repeated cards | PASS source | Repeated table rows serve comparison; no feature-card grid |
| R-19, motion | PASS source | Pressed feedback only, with reduced-motion handling |
| R-22, illustration | Not used | No decorative illustration or fake screenshot |

## Antislop gate: hierarchy and craftsmanship

| Item | Status | Evidence / limit |
|---|---|---|
| Explicit dials | PASS source | ENERGY 1 / RHYTHM 1 / MOTION 1 |
| Dial consistency | Initial render reviewed | Uniform table alignment supports repeated comparisons |
| Focal point | Initial render reviewed | Stock positions dominate the workspace |
| Structural spacing | Initial render reviewed | Header, action bar, filters and rows use distinct compact bands |
| Deliberate accent | PASS source | Plum marks transactions, teal marks interaction/selection, semantic colors mark quality |
| Identity motif | PASS source | Product reference, location and numeric columns form the repeated operational pattern |
| Design Read | PASS source | Audience, mood, palette and composition recorded before the rebuild |
| C-1, intentionality | PASS source | DESIGN.md records why hierarchy, type, color and density were selected |
| C-2, completeness | Pending browser verification | All displayed controls have local behavior; final execution checks remain open |
| C-3, content | PASS source | Stock dimensions determine the columns and actions |
| C-4, resilience | Pending browser verification | Responsive, focus and failure-state source exists; hardware and full browser checks are open |
| C-5, evidence | PASS source | Static, initial-render, incomplete browser and unrun production checks are separated |
| R-05, composition | Initial render reviewed | Reference-driven operational table replaces the former presentation catalog |
| R-11, radius | PASS source | Small radii distinguish controls and dialogs; rows remain flat |
| R-15, actions | PASS source | Labels identify the transaction or recovery operation |
| R-16, wording | PASS source | Operational copy, without marketing slogans |
| R-20, product specificity | PASS source | Physical, committed, free, quality and location fields are explicit |
| R-21, appearance | Source checked | User-reference light appearance is default; dark is an optional preference |
| R-29, palette | PASS source | Neutral surfaces, transaction plum and teal interaction roles; additional colors only express quality/errors |
| R-30, reference use | PASS source | Composition follows the user's explicit reference; brand assets were not copied |
| R-31, reasons | PASS source | Major visual choices are explained in DESIGN.md |

## Remaining verification

Run the retained browser checks in a permitted environment, inspect every module at desktop and narrow widths, complete download and keyboard checks, and review the actual device behavior. A complete antislop UI delivery pass has not been claimed.
