# Working in this repository

Read `README.md` first. It has one rule, and it is the whole point of this
repository.

**Every top-level folder is a separate project, and no two projects are linked
in any way.** No shared imports, packages, lockfiles, config, tooling, CI,
secrets or documentation. Nothing may reference a path outside its own
top-level folder.

This is the rule an agent is most likely to break, usually with good
intentions. When you notice that two projects need the same helper, the same
lint config or the same Docker base image, **copy it**. Do not factor it out.
Duplication between projects is a feature here, because it is what keeps them
separable.

Before finishing any change, check it against the test in the README: could
this folder be dragged out into an empty repository and still build, test and
deploy without edits?

Work inside one project at a time, and follow that project's own `CLAUDE.md`
and README. They are the authority for everything below their folder.
