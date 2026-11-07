# Roles

Roles are the steps of your ladder: each one sets the level it requires in each category. A person can be compared with
any role in the app, and the role also appears in the [share link](share-link.md).

Each entry of `roles.yml` has these fields:

| field  | description                                                                                         |
|--------|-----------------------------------------------------------------------------------------------------|
| key    | a unique and short identifier for the role                                                          |
| name   | the name of the role, e.g. Senior AI Platform Engineer                                              |
| levels | the level the role requires in each category, by category key, e.g. `{ comm: 3, ai: 2 }`. Missing categories count as level 0 |

```yaml
# config/roles.yml (or config.example/roles.yml)
- key: assoc
  name: Associate (L1)
  levels: { build: 1, ai: 1, data: 1, cloud: 1, trust: 1, agentic: 1, deliv: 1, biz: 1, comm: 1, people: 1 }
```

The sample ladder in `config.example/roles.yml` has four technical families (Product Maker, AI Platform, Data Platform
and Cloud Platform), each with three steps: the role, Senior and Lead. The career step (L1 to L5) is part of each
name, for example `Senior Product Maker (L3)`, so that roles of different families can be compared. Lead is the
technical leadership of an area, without managing people; managing people is the Product Engineering Manager, followed
by the Product Engineering Director. Replace them with the roles of your own ladder.

See also: [Categories](categories.md) for the category keys a role can mention, and [Configuration](configuration.md) for
where the file goes.
