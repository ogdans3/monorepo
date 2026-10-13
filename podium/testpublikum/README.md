# Testpublikum

A room full of phones for Podium, for trying a presentation out before the
room is there. Pick a presentation, a number of phones and a tempo. The
phones then do what the ballot page does. Each holds the presentation's
stream open, and when a question comes up on the screen, it answers after a
few seconds, or lets the question go by. The display counts and chimes for
them as it would for a room.

- **They are phones to Podium.** Each one has its own cookie jar, and so its
  own voter id, and uses only the phone's endpoints: `/api/live/{code}/events?ballot`,
  `GET /api/stem/{code}` and `POST /api/stem/{code}`. The display's phone count
  counts them.
- **A room, not a random number generator.** A room leans: the first time a
  question is seen, each answer gets a gamma(2) weight that every phone shares,
  and each phone picks by those weights. They answer a while after the question
  comes up, on a log-normal delay, and some of them not at all. The three
  tempos, *Rolig*, *Vanlig* and *Lynrask*, are in `run.go`, with the sentence
  the page shows for each.
- **A phone does what a person would.** It lets an answer go when the question
  leaves the screen before it was given. When the votes are reset, it answers
  again. When its stream ends, it starts a new one, which on freelunch is every
  two minutes.
- **The votes are real votes.** They stay in the presentation until they are
  reset. Podium's start dialog offers to reset them. A run stops by itself after
  three hours, so a rehearsal's room is not still voting in the talk.
- **Signing in is Podium's.** The password is checked by Podium
  (`POST /api/admin/login`), and the session is Podium's admin session, kept in
  this site's own cookie and checked with Podium (`GET /api/admin/me`) at most
  every five minutes. Testpublikum keeps no secret. Changing Podium's password
  signs it out too.

The page is a page of Podium's desk, and follows `../DESIGN.md`. Its tokens are
copied into `ui/app.css`, and Archivo is copied into `ui/fonts`.

## Run it

You need Go 1.27, and a Podium to point it at.

```sh
PODIUM_URL=http://127.0.0.1:4120 PORT=4140 go run .
```

Open <http://127.0.0.1:4140> and sign in with that Podium's admin password.

## Test

```sh
go vet ./... && go test -race ./...
```

The tests run phones against a fake Podium in the test file. They cover:

- every phone answers each question once, and the page's tally agrees with
  Podium's;
- an answer still to be given is let go when the question leaves the screen;
- phones come back when their streams are cut;
- the room answers again after a reset, and a reset after the room shrank
  counts only the phones still in it;
- turnout leaves some out;
- a deleted presentation ends the run;
- the room leans the way its lean says;
- only Podium's admin can start a room.

## Configure

| Variable     | Default                       | What it is             |
| ------------ | ----------------------------- | ---------------------- |
| `PODIUM_URL` | `https://podium.freelunch.no` | The Podium to vote in. |
| `PORT`       | `8080`                        | Where it listens.      |

## Deploy

It runs at <https://testpublikum.freelunch.no> as its own container, through
master-dashboard. The symlink `/home/ai_user/git/testpublikum` points to
`monorepo/podium/testpublikum`, and `.dashboard.yaml` gives the port and
`PODIUM_URL`. It holds nothing worth keeping, so a deploy is safe whenever
nobody is mid-test. It does stop any run in progress.
