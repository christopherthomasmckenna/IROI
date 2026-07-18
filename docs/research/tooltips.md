# Field Explanations: Research, Options, and Recommendation

*Punch-list item 6 deliverable (2026-07-18). Research summary → options →
recommendation for how IROI presents per-input guidance and how admins author
it. Sources linked throughout; full citations in the research notes at the end.*

## The problem

Each of the model's inputs carries guidance that must do three jobs for a
study creator: explain **what the input means**, say **where the Philadelphia
default came from**, and tell them **how to find their own jurisdiction's
value**. Today that content lives in a single plain-text blob per variable
(spreadsheet label + notes, admin-overridable in one textarea) and is shown
only in a **hover tooltip** behind a ⓘ icon.

That delivery mechanism is the weakest link, on the evidence:

- **Hover doesn't exist on touch.** Tooltips "are not normally available on
  touchscreens" ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/));
  on tap devices the tip appears only as the user is already pressing
  ([Inclusive Components](https://inclusive-components.design/tooltips-toggletips/)).
  A public-facing tool will be read on iPads in meetings.
- **Long content disqualifies the format.** "Lengthy content is no longer a
  'tip'" (NN/g); Intuit caps tooltip bodies at ~130 characters
  ([Intuit Content Design](https://contentdesign.intuit.com/product-and-ui/tooltips/)).
  Our explanations are multi-sentence and should get *longer* (provenance,
  localization guidance), not shorter.
- **Accessibility is expensive for hover, cheap for alternatives.** WCAG 2.1
  SC 1.4.13 requires hover content to be dismissible, hoverable, and
  persistent ([W3C](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html));
  click-revealed content sidesteps it entirely.
- **The field's consensus rule disqualifies our exact use case.** NN/g, USWDS,
  Intuit, and GOV.UK's guidance all agree: information users *need* to
  complete the task must not live only in a tooltip. "Where the default came
  from" is exactly what a creator needs before deciding to override a value.
- **Telling signal:** GOV.UK's design system ships **no tooltip component at
  all** — its only sanctioned help mechanisms are a short always-visible hint
  line and an inline "details" expander
  ([GOV.UK](https://design-system.service.gov.uk/components/text-input/),
  [details](https://design-system.service.gov.uk/components/details/)).
  Shopify Polaris: "If you're building something that requires a lot of
  tooltips, work on clarifying the design and the language in the experience"
  ([Polaris](https://polaris-react.shopify.com/components/overlays/tooltip)) —
  we have ~40 of them.

## The content-structure insight (independent of any UI choice)

The research converges on a **layered model** that maps one-to-one onto our
three jobs — and our current one-textarea data model can't express layers:

| Layer | Content | Surface |
|---|---|---|
| 0 | Prevent the question: plain labels, source-spreadsheet ordering | already done |
| 1 | One always-visible sentence ("what this is", `aria-describedby`-linked) | hint line |
| 2 | On-request depth: why it matters, **how to find your local value** | expandable |
| 3 | Reference: **default provenance**, citations, typical ranges | expandable / methods page |

This mirrors Intuit's "Point of Need" pattern (short clear answer first,
expandable depth beneath —
[Intuit](https://contentdesign.intuit.com/content-patterns/help-content/)) and
GOV.UK's hint-plus-details pairing. **Whatever UI we pick, the
`field_explanations` table should grow from one text blob to structured
fields:** `short_hint`, `meaning`, `how_to_localize`, `provenance`.

## Options

### Option A — GOV.UK-style two-layer inline (hint + disclosure) ⭐ recommended
Each variable card gets a short always-visible hint line, and an inline
**"More about this input"** expander containing the full layered guidance
(meaning, how to find your number, default provenance). Built on the native
`<details>`/disclosure pattern — the one help pattern with full consensus
backing ([APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)),
excellent on mobile ([NN/g](https://www.nngroup.com/articles/mobile-accordions/)),
no content-length ceiling, printable, cheap to build.
**Costs:** adds vertical weight to an already-dense page; hidden-by-default
content can be missed.

### Option B — TurboTax-style help side panel
Per-field triggers written with information scent ("How do I find this for my
county?") open a slideout panel with the full formatted guidance; the user
never leaves the form ([TurboTax teardown](https://www.appcues.com/blog/how-turbotax-makes-a-dreadful-user-experience-a-delightful-one)).
Best surface if guidance grows long and formatted (tables of reference
values, links to court-data sources).
**Costs:** highest build effort (focus management, Escape handling, mobile
bottom-sheet variant); no design system ships it ready-made.

### Option C — minimal fix: hover → click toggletip
Convert the existing ⓘ from hover to click (touch works, WCAG 1.4.13 mostly
sidestepped), cap the toggletip at the short definition, link "full guidance"
beneath. Smallest code delta.
**Costs:** keeps the weakest-discoverability trigger; still two steps to the
important content; retains the pattern every government system declined to
ship.

### Comparison (from the research)

| | Long content | Discoverability | Mobile | Accessibility | Effort |
|---|---|---|---|---|---|
| Hover tooltip (today) | ✗ | weak | ✗ | costly to fix | — |
| C: click toggletip | weak | weak | ok | ok | low |
| **A: hint + disclosure** | **strong** | **good** | **strong** | **strong** | **low-med** |
| B: side panel | strong | good | ok | needs care | med-high |

## Recommendation

**Adopt Option A, in two phases, with the structured content model
underneath.** Rationale: it's the only option where every element is a
consensus-backed pattern; it handles the content we actually have (and want to
grow); it's the cheapest to make fully accessible; and the case page's
card-per-variable layout already has a natural spot for an expander (next to
the annotation row). Option B remains the natural *upgrade* later if guidance
grows rich enough to need a persistent panel — the structured content model
serves either surface unchanged.

### Phase 1 — stop the bleeding (small, immediate)
Convert `InfoTip` from hover to click-toggle (Option C's mechanic) with
Escape-to-close. No content or schema changes. Fixes touch + accessibility
now, independent of the bigger work.

### Phase 2 — the real feature
1. **Schema:** extend `field_explanations` (or successor `field_guidance`)
   to `short_hint` / `meaning` / `how_to_localize` / `provenance`, all
   nullable, falling back to today's JSON-derived text where empty.
2. **Case page:** hint line rendered under each variable label
   (`aria-describedby`-linked); "More about this input" disclosure rendering
   the remaining layers. The ⓘ icon retires.
3. **Admin authoring (`/admin/fields`):** one form per variable with the four
   structured fields, **Markdown** support for the long fields, a live
   preview pane, and `updated_at`/`updated_by` shown per field. This is the
   docs-as-code lesson with the git hidden behind a form
   ([Write the Docs](https://www.writethedocs.org/guide/docs-as-code/),
   [Decap pattern](https://decapcms.org/)).
4. **Content migration:** seed `short_hint` by truncating existing
   explanations at the first sentence; the researchers refine from there —
   this is exactly the "read-through of the field explanations" homework we
   gave them after the demo.

### Phase 3 — optional later
A public **"Model methodology"** page assembling every variable's full
guidance (layer 3 anchor targets), linkable from disclosures and from the
PDF export. Draft→review workflow for guidance edits if multiple researchers
start authoring.

### Explicitly not recommended
Keeping hover as the only surface for provenance/localization guidance — by
the shared rule of NN/g, USWDS, Intuit, and GOV.UK, content a creator needs
in order to decide whether to override a default is task-critical and must
not be hover-only.

## Research notes

Full agent research report available on request; key primary sources:
[NN/g tooltip guidelines](https://www.nngroup.com/articles/tooltip-guidelines/) ·
[NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) ·
[WCAG 1.4.13](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) ·
[ARIA APG disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) ·
[GOV.UK text input / hint text](https://design-system.service.gov.uk/components/text-input/) ·
[GOV.UK details component](https://design-system.service.gov.uk/components/details/) ·
[GOV.UK designing good questions](https://www.gov.uk/service-manual/design/designing-good-questions) ·
[USWDS tooltip](https://designsystem.digital.gov/components/tooltip/) ·
[Intuit Content Design: tooltips](https://contentdesign.intuit.com/product-and-ui/tooltips/) ·
[Intuit: help content patterns](https://contentdesign.intuit.com/content-patterns/help-content/) ·
[Inclusive Components: tooltips & toggletips](https://inclusive-components.design/tooltips-toggletips/) ·
[Baymard: input fields](https://baymard.com/learn/input-fields) ·
[Shopify Polaris tooltip](https://polaris-react.shopify.com/components/overlays/tooltip) ·
[Stripe Markdoc](https://stripe.dev/blog/markdoc).

One correction surfaced during verification: GOV.UK has no literal "do not
use tooltips" sentence — their stance is structural (no tooltip component
exists; hint text and details are the only help mechanisms). Cited
accordingly above.
