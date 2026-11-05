# Let AI do more work without giving away the direction

I want AI to take on more of the work of building software, while people remain
responsible for deciding what is worth building and whether it helps anyone.
My first way of explaining this was that AI is a good backward thinker: it
learns patterns from what already exists, while people must think ahead. That
captures my concern about giving away judgement, but the literature makes me
revise it. Learning from existing work does not mean a system can only repeat it.
The boundary I defend is responsibility, not a claim that humans alone can
produce new ideas.

## Faster at what?

[Peng et al. (2023)](https://arxiv.org/abs/2302.06590) found that, among successful
task completers in a controlled experiment, developers using Copilot took 55.8%
less time to build a JavaScript HTTP server. That is a
strong reason to take assistance seriously. However, one contained task does
not establish better architecture, maintainability or a product people need.

[Becker et al. (2025)](https://arxiv.org/abs/2507.09089) found the opposite in a
different setting: 16 experienced developers completing 246 tasks in familiar
open-source projects took 19% longer with AI, although they believed it helped.
Neither result gives a universal answer. Task boundaries, existing knowledge
and review effort matter. METR's [2026 follow-up](https://metr.org/blog/2026-02-24-uplift-update/)
suggested speedups, but participation and task-selection problems prevented a
reliable estimate. I cannot use the earlier slowdown as a verdict on today's
tools. Together, these studies make me ask what work was measured and what
costs were left outside it, rather than treating felt speed as success.

## Direction needs more than a prompt

[Böckeler (2026)](https://martinfowler.com/articles/harness-engineering.html)
describes a harness with guides that steer agents and sensors that inspect
their output. This gives my idea of direction something practical: references,
constraints and checks that survive the conversation. Her account also admits
that checks cannot reliably rescue an unclear goal. It is practitioner guidance,
not an experiment proving that more instructions always produce better software.

[Storey (2026)](https://arxiv.org/abs/2603.22106) explains another limit through
cognitive debt, where shared understanding erodes, and intent debt, where the
reasons behind decisions are missing. A detailed repository can still leave
its developers unable to explain it. This is a proposed framework, not proof
that using AI inevitably weakens skill. I find it useful because it challenges
an easy solution to my concern: generating more documentation is not enough.
Someone must understand, question and maintain the decisions it records.

These accounts complement each other. Böckeler explains how to guide and check
work; Storey asks whether the people overseeing it retain understanding. In my
game, tests could establish shield damage, but watching someone try to protect
their head exposed a mismatch in the experience. A green check answers the
question encoded in it. It does not establish that this was the right question.

## The strongest challenge to my position

[Romera-Paredes et al. (2023)](https://doi.org/10.1038/s41586-023-06924-6) show
why I cannot reserve creative work for humans and leave AI only repetitive work.
FunSearch combined a language model, program search and an evaluator to find
new mathematical constructions and useful bin-packing heuristics. That is more
than reproducing a familiar answer. If systems can propose and test new ideas,
requiring a person to approve every step could become the bottleneck.

I accept that challenge. However, FunSearch worked on problems with efficient
evaluators, human-provided objectives and a program skeleton. Its success does
not establish who should choose the objective, or whether a measurable score
captures what people value. My inference is that delegation should depend on
how clearly an outcome can be evaluated and what happens if it is wrong,
rather than whether the work sounds routine or creative.

I expect useful agents to do more planning and experimentation as well as
implementation. I would give them room to propose alternatives, then judge
those alternatives against evidence and users' needs. Developers should retain
enough understanding to challenge an answer, change the goal and take
responsibility when the result fails. That is the future I want: AI helping
row the boat, including suggesting a better route, while people remain
answerable for where it goes.

## References

- Peng, S., et al. (2023). *The Impact of AI on Developer Productivity: Evidence from GitHub Copilot*. arXiv:2302.06590.
- Becker, J., et al. (2025). *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*. arXiv:2507.09089.
- METR (2026). *We are Changing our Developer Productivity Experiment Design*. February 24.
- Böckeler, B. (2026). *Harness engineering for coding agent users*. martinfowler.com.
- Storey, M.-A. (2026). *From Technical Debt to Cognitive and Intent Debt*. arXiv:2603.22106, v4.
- Romera-Paredes, B., et al. (2023). *Mathematical discoveries from program search with large language models*. Nature, 625, 468–475 (2024 volume; published online 2023).
