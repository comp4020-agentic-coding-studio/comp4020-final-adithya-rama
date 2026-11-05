# Portfolio review: 5 November 2026

This is the final portfolio revision record, not a reconstruction of what was
written at earlier crit cutoffs. The three personal reflections and the crit
tags are preserved. The user's original untracked research-note scaffold was
backed up locally before replacement; it is not an additional submission.

## What changed and why

- Rewrote README.md around a small group of friends making decisions together.
  It connects own-flag recovery, fair shared outcomes and readable controls to
  that aim, explains omissions, and separates automatic checks from player
  judgement. Detailed controls remain in docs/DEVELOPMENT.md.
- Rewrote PROCESS.md as a current account, with real commit links for research,
  integration, observed problems, changed design choices and regressions.
- Wrote research-note.md for COMP8020 from the user's argument about retaining
  direction. Removed the scaffold label and corrected the earlier scaffold's
  misleading suggestion that Böckeler advocates removing human judgement.
- Consolidated current requirements in CLAUDE.md and docs/QUALITY_CONTRACT.md;
  spec/README.md maps those claims to actual checks and their limits.
- Added spec/readme-content.test.ts: all rendered text and source links must
  match the current README, and its local documentation links must resolve.
  The original course invariants remain unchanged. Corrected stale controls
  guidance that still tied movement to aim.

## Personal evidence and authorship

Adithya supplied the childhood-game motivation, disappointment with the first
outputs, use of images and documentation, agent-direction argument, and peer
observations. On 5 November he confirmed that the gameplay problems reported
throughout the conversation came from peers' play, including weapon acquisition,
shield coverage and expected rocket damage. This supports concrete examples;
it does not establish participant counts, verbatim quotations or successful
retests. No such details have been added.

Agents assisted with source selection, evidence checking, structure and editing.
The texts do not claim that these newly selected readings were all read before
implementation. The research note distinguishes the user's position from what
its sources actually establish. Its revised argument permits AI-generated ideas
while retaining human accountability for purposes and acceptance.

## Research reading and source limits

| Source | Role in the argument and limit |
| --- | --- |
| [Sloan, 2020](https://www.robinsloan.com/notes/home-cooked-app/) | A personal case for software whose value comes from its small audience. It motivates scope; it is not evidence that this game is enjoyable. |
| [Hunicke, LeBlanc and Zubek, 2004](https://www.cs.northwestern.edu/~hunicke/MDA.pdf) | A design framework linking rules, play and experience; it helps distinguish an objective counter from observed teamwork. |
| [Peng et al., 2023](https://arxiv.org/abs/2302.06590) | Controlled task-completion experiment. A contained JavaScript task cannot establish general product value or long-term maintenance benefits. |
| [Becker et al., 2025](https://arxiv.org/abs/2507.09089) | Randomized work in familiar mature repositories. Its population and early-2025 tools differ from Peng's setting. |
| [METR, February 2026](https://metr.org/blog/2026-02-24-uplift-update/) | Follow-up warns that participation/task selection make current speedup estimates unreliable. Prevents treating the older slowdown as a current universal result. |
| [Böckeler, April 2026](https://martinfowler.com/articles/harness-engineering.html) | Practitioner account of guides, sensors and human intent. Useful workflow reasoning, not measured proof of the workflow's effects. |
| [Storey, 2026, v4](https://arxiv.org/abs/2603.22106v4) | Conceptual model distinguishing code problems, lost understanding and missing intent. Not a causal study showing inevitable deskilling. |
| [Romera-Paredes et al., online 2023](https://doi.org/10.1038/s41586-023-06924-6) | FunSearch is a serious counter-case to reserving novelty for humans. Efficient evaluation and human-provided objectives bound the inference. The cap-set problem was not solved in general. |

The FunSearch author manuscript was also inspected at
[the authors' hosted PDF](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/funsearch-making-new-discoveries-in-mathematical-sciences-using-large-language-models/Mathematical-discoveries-from-program-search-with-large-language-models.pdf).
The [final brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
and [assessment criteria](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/)
were checked directly. Source selection combines empirical work, a conceptual
paper, a research counter-case and practitioner writing; none is treated as
conclusive outside its scope.

## Verification

Local production build at http://localhost:8097, using a separate test database:

- `mise exec -- pnpm build`: passed; existing bundle-size advisory remains.
- `APP_URL=http://localhost:8097 mise exec -- pnpm check`: TypeScript passed,
  510 unit tests and 42 specification tests passed, including both new README tests.
- `mise exec -- pnpm check:evidence`: all three reflection filenames found;
  all 15 distinct PROCESS commit citations resolve.
- `APP_URL=http://localhost:8097 mise exec -- pnpm check:browser`: practice
  rounds, controls, results and history passed at 1920×1080 and 390×844.
- A separate Chromium inspection with JavaScript disabled confirmed the full
  README at both sizes, no horizontal overflow and readable full-page screenshots.
  Local outputs are in ignored `test-results/portfolio-2026-11-05/`.
- An independent agent reviewed the argument, source methods and sampled commit
  evidence. Corrections clarified the Copilot study population, fixed the METR
  reference title and made the writing-assistance disclosure explicit.

Word counts for the original portfolio revision b529b2b, including headings/link labels and the research
references but excluding Markdown link destinations: README 531; PROCESS 964;
research note 772. These are counts, not an automated assessment of quality.

Historical container, deployment and playtest evidence remains explicitly dated
in the documents it came from. This documentation revision does not claim a new
live deployment or a new human playtest.

## Follow-up: recovered peer-session evidence and images

Adithya recalled a peer session on 21 October around 11 am AEDT, then confirmed
that the recovered Outpost FFA and Catacombs TDM rounds sounded like his group.
Read-only production SQLite queries recovered the completed results. The
sanitized extract preserves five pilot records in the first round and four of
the same profiles in the second, without publishing names, profile IDs or
credentials. These are match results, not a recovered event-log transcript.

`docs/PLAYTEST.md` now combines that evidence with his already supplied
observations, explicitly separating feedback across weeks from this session.
It does not claim successful same-person retests or observed Flag Delivery
teamwork. The source details and selected JSON excerpts are committed under
`docs/evidence/`.

Two original, unedited screenshots illustrate specific corrections in PROCESS:
phone team labels and overhead shield protection. They are dated automated live
checks, clearly separate from the peer session. Their provenance, hashes and
selected assertion results are recorded beside them. An existing broken
relative link from PROCESS to CLAUDE was corrected to the public repository URL.

Follow-up validation on 5 November:

- Four relevant HTTP publication tests passed (`spec/invariants.test.ts` and
  `spec/readme-content.test.ts`).
- PROCESS, PLAYTEST and the evidence index loaded with JavaScript disabled at
  1920×1080 and 390×844. Both images loaded, all local links returned 200, and
  there was no page-level horizontal overflow. Figure screenshots were inspected.
- `pnpm check:evidence` passed; all 15 distinct process commit citations resolve.
- `git diff --check` passed; historical reflections were untouched.
- Independent evidence review checked timestamps, score totals, shared aliases,
  privacy exclusions, image hashes and the limits of the written claims.
- Counts after this follow-up, excluding image alt text/HTML but including prose
  captions and references: README 538; PROCESS 1,055; research note 772.

No gameplay code changed. This follow-up did not rerun the complete gameplay
suite or create another human playtest. It was prepared locally; a new
publication/deployment is not claimed here.
