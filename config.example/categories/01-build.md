---
key: build
name: Product Engineering
description: The craft of building software products end to end, from the design of the interface to the services and data behind it, when much of the code is written by agents and the engineer answers for all of it
---

## Level 1

### Ships small, well-scoped changes to an existing product

**Example behaviours:**

- Fixes bugs and makes small changes to screens, endpoints or jobs following the team's conventions
- Writes tests for the code they change and keeps the build green
- Asks for help early when a change touches unfamiliar parts of the product
- Understands every line they submit, whoever or whatever wrote it

## Level 2

### Delivers complete features with agents and answers for them

**Example behaviours:**

- Writes the spec and the acceptance criteria before handing a feature to an agent, across the interface, the API and the storage it needs
- Uses tests as the contract: they describe the expected behaviour and the agent has to make them pass
- Reviews the whole diff, not only whether it works, and can explain every decision in it

### Designs simple user flows on their own

**Example behaviours:**

- Sketches the flows and screens of a feature and checks them with users or the team before building them
- Follows the design system and handles loading, empty and error states, whoever wrote the code

### Builds prototypes quickly

**Example behaviours:**

- Builds a clickable or working prototype in hours, with agents, when the team needs to test an idea
- Throws prototypes away when they have answered the question, instead of shipping them as they are

## Level 3

### Designs the feedback loops that let agents iterate on their own

**Example behaviours:**

- Makes sure an agent can check its own work: fast tests, types, linters, preview environments and evaluations it can run
- Turns every bug an agent introduced into a test or a rule, so that it does not happen again
- Owns the quality of the code that agents produce in their area: refactors, removes dead code and pays technical debt as part of the work

### Makes interaction design decisions

**Example behaviours:**

- Designs the interaction of complex flows, with accessibility in mind from the start
- Improves the interaction from usage data and feedback, not only from the original design

### Builds AI-powered features into the product

**Example behaviours:**

- Integrates model calls into the product with streaming and loading states that make latency acceptable
- Designs interfaces that show uncertainty and let users correct or undo what the AI did

## Level 4

### Makes the architecture readable and safe for agents

**Example behaviours:**

- Designs modules with clear boundaries and APIs, so that people and agents can change one part without breaking the others
- Documents the conventions and the context that agents need, and keeps them up to date as the code changes
- Keeps CI fast and gives agents sandboxes and limited permissions to work in
- Decides which changes an agent can make without human review and which always need one

### Raises the bar of engineering quality

**Example behaviours:**

- Defines quality standards for the product (performance budgets, accessibility, testing, error handling) and makes them measurable
- Reviews designs and pull requests of other teams and improves them
- Contributes components and patterns to the design system that other teams use

## Level 5

### Sets the technical direction of the product

**Example behaviours:**

- Sets the technical direction of the whole product over the coming years and aligns teams around it
- Makes the big technical bets: changes of architecture, platforms and frameworks, build versus buy, and when to pay down debt or rewrite
- Shapes how small teams own products end to end, from the interface to the data, with clear ownership and few hand-offs
- Is recognised outside the company for their product engineering practice
