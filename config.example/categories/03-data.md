---
key: data
name: Data Platform
description: Moves, models and governs data so that people, products and AI systems can trust it and use it on their own
---

## Level 1

### Works with the data the product produces

**Example behaviours:**

- Writes correct, readable SQL and checks the results before sharing them
- Understands the main data models of the product and where each piece of data comes from
- Fixes small issues in existing pipelines following their runbooks

## Level 2

### Builds reliable data pipelines

**Example behaviours:**

- Builds batch and streaming pipelines that are idempotent, tested and easy to backfill
- Adds data quality checks (freshness, volume, schema, nulls) and alerts on them
- Writes the documentation and ownership of every dataset they create

### Lets agents work safely with data

**Example behaviours:**

- Reviews the SQL and the transformations an agent writes against real data before trusting them
- Gives agents read-only access and sample data unless a task truly needs more

### Prepares data for analytics and AI

**Example behaviours:**

- Builds tables that analysts and models can use without asking how they were made
- Builds the pipelines that load documents and embeddings into a vector store and keep them up to date

## Level 3

### Models business domains and data contracts

**Example behaviours:**

- Designs data models that reflect the business and survive changes in the product
- Agrees data contracts with the teams that produce data, so that breaking changes are caught before they ship
- Chooses between batch, streaming and change data capture for each use case

### Takes care of privacy and lineage

**Example behaviours:**

- Classifies personal and sensitive data, and applies retention, masking and access rules
- Keeps lineage so that anyone can see where a number or a training dataset comes from

### Makes data understandable for people and agents

**Example behaviours:**

- Describes datasets, columns and metrics in a semantic layer or catalogue, so that agents can answer data questions correctly
- Writes contracts and quality checks that an agent can run to validate a change to a pipeline

## Level 4

### Builds the data platform as a product

**Example behaviours:**

- Designs a self-service platform (lakehouse, catalogue, orchestration, feature and vector stores) that other teams use without help
- Measures the platform by its adoption, reliability and cost
- Makes the governance rules part of the platform instead of a manual review
- Lets agents build and operate pipelines within the platform's guardrails: permissions, quality checks and automatic rollback

### Leads data quality across teams

**Example behaviours:**

- Defines the service levels of critical datasets and leads the response when they break
- Helps the teams that produce data own its quality, instead of fixing it downstream

## Level 5

### Defines the data strategy of the company

**Example behaviours:**

- Aligns leadership on how data and AI create value, and invests where it matters most
- Decides the long-term architecture and vendors of the data platform
- Builds a culture where data quality is everyone's responsibility
- Decides which company data can train or feed AI systems, and under which conditions
