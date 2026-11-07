# The share link: the state in the URL

Everything the app knows about a person is in its address, so a link can be bookmarked, sent or pasted in a document.
To keep a link as a record that does not change, use [snapshots](snapshots.md).

The person is stored in the URL fragment (the part after `#`) as readable parameters, which the app keeps up to date
while you make changes. The fragment is never sent to the server, so the person's data does not reach access logs.

| parameter        | description                                                                              |
|------------------|------------------------------------------------------------------------------------------|
| `name`           | the person's name; omitted when empty                                                    |
| `role`           | optional: the key of the person's current role                                           |
| `compare`        | optional: the key of the role to compare with                                            |
| `tag`            | optional: a tag the person is interested in; repeated once per tag                       |
| `<category key>` | the level reached in that category, e.g. `comm=2`; one per category, always written last |

```
/#name=John+Connor&role=assoc&compare=maker&tag=tech&build=2&ai=1&data=1&cloud=1&trust=1&agentic=2&deliv=1&biz=1&comm=2&people=0
```

You can edit the link by hand: changing the fragment in the address bar updates the page without reloading.

Unknown categories and roles are ignored and levels are clamped, so old links keep working when the configuration
changes. When a link had data that could not be used, or is not valid at all, the app still opens, with the valid data
or with an example, and a dismissible notice names what was ignored. Without a fragment the app starts with an example
based on a random role.

Links created by earlier versions (`/?state={"name":"John Connor","levels":{…},"roleKey":"assoc",…}`) keep opening;
the app rewrites them in the new format after the first change.

See also: [Snapshots](snapshots.md), which save and reopen links, and [ADR 0001](../adr/0001-readable-share-url-format.md)
for why the format is this one.
