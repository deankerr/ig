---
name: gt
description: 'Shortcut to create a Graphite branch from current changes and submit the stack. Usage: /gt [optional instructions]'
disable-model-invocation: true
argument-hint: '[instructions]'
---

Commit our current changes with Graphite and submit the stack.

Default:

- Use `gt c -am "<message>"` to create, stage all and commit
- Then `gt ss` and share the Graphite PR links form the output.
- Include changes to docs/Claude files, etc.
- Arguments take priority if provided.

Other:

- `gt m` will amend instead.
- `gt m -c` new commit on current branch.
- `gt log` full branch/pr info.
- `gt ls` branch list only.
