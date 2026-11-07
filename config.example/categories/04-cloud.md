---
key: cloud
name: Cloud & Platform
description: Builds and runs the cloud infrastructure and the internal platform that teams use to ship software and AI workloads
---

## Level 1

### Uses the platform to ship and operate their own services

**Example behaviours:**

* Deploys services with the existing pipelines and reads their logs and metrics
* Understands the basics of containers, networking and cloud permissions

## Level 2

### Automates infrastructure as code

**Example behaviours:**

* Writes and reviews infrastructure as code (Terraform, Pulumi or similar) instead of making changes by hand
* Builds and improves CI/CD pipelines so that deployments are frequent and boring
* Applies least privilege to every role and secret they create
* Reviews the infrastructure code an agent writes, reading the plan before applying it

## Level 3

### Designs environments for software and AI workloads

**Example behaviours:**

* Designs Kubernetes or serverless environments with autoscaling, isolation and sensible defaults
* Runs model inference in production: GPU scheduling, model serving, cold starts and capacity planning
* Plans disaster recovery and tests it

### Gives agents a safe place to work

**Example behaviours:**

* Provides ephemeral environments where agents can build, test and deploy previews without touching production
* Gives agents short-lived credentials with the narrowest permissions, and logs everything they do

### Keeps cloud costs under control

**Example behaviours:**

* Makes the cost of each team and service visible, including the cost of tokens and GPUs
* Reduces cost with right-sizing, spot capacity, caching and reserved commitments, without hurting reliability

## Level 4

### Builds the internal platform as a product

**Example behaviours:**

* Builds golden paths and an internal developer platform that let teams create a service, a pipeline or an agent in minutes
* Talks to the teams that use the platform and prioritises from what they need
* Provides the compute that AI workloads run on, such as GPU capacity and serving clusters, with their cost per team
* Lets agents operate the platform within guardrails: policy as code, approvals for risky changes and automatic rollback

## Level 5

### Defines the infrastructure strategy of the company

**Example behaviours:**

* Decides the cloud, compute and AI provider strategy, including multi-cloud, on-premise GPUs and vendor lock-in
* Plans infrastructure years ahead from the growth of the business and of AI usage
* Decides how far agents can operate production, and how humans stay in control of it
* Is recognised outside the company for their platform engineering practice
