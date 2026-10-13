# Crit 9 reflection

## What was the breakthrough that moved the work forward?

My breakthrough this week was getting more precise about what I meant by a
working multiplayer game. I already had a live version, but I was still unhappy
with the maps, how similar the guns looked, and how some mechanics behaved.
Having features implemented did not mean they matched the game I had in mind. I
needed to explain the behaviour I expected in enough detail to check it.

For “All at once”, that matters because everyone needs to agree on what
happened. In my flag mode, each team carries its own flag, and only one flag per
team can be in play. I kept damage and scoring under the server’s control rather
than letting each browser decide independently. That supports the fairness
described in my README, although it means depending on the server and handling
delays between a player’s input and the confirmed outcome.

I grounded my requests in screenshots and specific rules, then used agents to
implement and test them. One multiplayer test tried to start after a fixed
pause, before everyone was ready. Changing the test to wait for the server’s
confirmation made that assumption explicit and testable.

## What did this work change about who I want to be as a software developer?

I still want to be the person thinking through the idea, brainstorming and
deciding how the system should work. This work has made that responsibility more
concrete: I need to turn my expectations into rules, question the agents’
output, and ask for evidence. I want agents to follow my direction, while I stay
responsible for whether the result actually makes sense for the people using it.

---

Adithya's own reflection, supplied on 14 October 2026.
Dàchī: Wednesday 10:30 am tutorial; Crit 9 cutoff Wednesday 14 October,
8:30 am Sydney/Canberra time.
