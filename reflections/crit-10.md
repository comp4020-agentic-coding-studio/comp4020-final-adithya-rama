# Crit 10 reflection

## What was the breakthrough that moved the work forward?

User acceptance testing helped me a lot this week. When I watched other people
playing, I could see where they struggled and hear what they wanted changed. I
noted those issues down and used them to decide what to improve. Having the
features there was not enough; I needed to see whether they made sense to
someone actually playing.

I also realised that development quality depends as much on the person
directing the model as on the model itself. When I gave Claude and GPT images
of maps, characters and guns, and explained movement, bullets and damage more
precisely, the results improved significantly. Leaving those decisions
uncertain gave the agents too much room to produce something different from
what I had in mind.

For this crit, logging adds another way to understand the game. I need to be
able to tell who joined, who killed whom, and why an action was rejected.
Readable server logs also give an agent evidence to debug a problem instead of
guessing from what the screen appears to show.

## What did this work change about who I want to be as a software developer?

I want to be the person thinking through the idea and deciding how the system
should work, with agents helping me build it. That means giving them a clear
direction, useful references and documentation, then checking their output
against what users experience.

I want to keep watching people use what I build, noting their feedback and
turning it into specific changes. I am still responsible for the quality of the
result, including who can change shared state and whether the logs let me
explain what happened.

---

Drafted with agent assistance from Adithya's first-person account supplied on
21 October 2026. Dàchī: Wednesday 10:30 am tutorial.
