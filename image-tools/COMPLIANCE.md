# Record of processing activities

GDPR article 30. Not published: this is the internal record you hand to
Datatilsynet if they ever ask what the site does with personal data. Keep it
current with `src/routes/privacy/+page.svelte`, which is the public version of
the same facts.

The small-organisation exemption in article 30(5) is not relied on here.
Website analytics runs on every visit rather than occasionally, and the record
is one page, so writing it is cheaper than arguing about whether it was needed.

## Controller

| | |
|---|---|
| Name | Teorimester AS |
| Organisation number | 930 860 301 |
| Address | Bueråsen 4, 3234 Sandefjord, Norway |
| Contact | hello@imagetoolbox.org |
| Data protection officer | None. Not required: no large-scale monitoring, no special categories, no public authority. |

## Activity 1: visitor statistics

| | |
|---|---|
| Purpose | Counting visits and seeing which tools are used, to decide what to build |
| Legal basis | Legitimate interest, article 6(1)(f). Balancing test below. |
| Data subjects | Visitors to imagetoolbox.org |
| Categories of data | IP address (as an input, not stored), user agent, page address, referrer, country derived from IP, screen size |
| Recipients | PostHog, Inc. as processor, PostHog Cloud EU (Frankfurt) |
| Transfers outside the EEA | Yes. PostHog is US-based and Cloudflare's edge network is worldwide. Covered by the standard contractual clauses in the DPA. |
| Retention | The daily salt is deleted by PostHog once the day's events are processed. Events carry no identifier that survives that day. |
| Security measures | No cookies or device storage, no person profiles, `identify()` and `alias()` never called, EU region, first-party relay so the browser never contacts a third party directly |

**Balancing test.** The interest is knowing which of 138 pages are worth
maintaining, which is hard to do any other way. The intrusion is minimal: no
profile is built, nothing is written to anyone's device, the identifier stops
meaning anything after a day, and no data subject could be picked out or
contacted from what is stored. A visitor who objects is honoured through Do
Not Track or Global Privacy Control, which the site checks before the
analytics library is even loaded. Content blockers work and are not worked
around. On that balance the interest is not overridden.

## Activity 2: server logs

| | |
|---|---|
| Purpose | Keeping the service running and dealing with abuse |
| Legal basis | Legitimate interest, article 6(1)(f) |
| Categories of data | IP address, request line, user agent, timestamp |
| Recipients | None. Logs stay on the host. |
| Transfers outside the EEA | None |
| Retention | **Open. Decide what Traefik actually logs and with what rotation, then write the real answer here and in the privacy policy, which currently hedges.** |

## Not a processing activity: the images themselves

Worth stating because it is the question everyone asks. Conversion and editing
happen entirely in the visitor's browser. No image is uploaded, received,
stored or seen by us or by any processor, so there is no processing of the file
contents to record. This is a property of how the site is built, not a policy
that has to be enforced, and it is verifiable in the browser's network tab.

## Processors

| Processor | Purpose | Agreement |
|---|---|---|
| PostHog, Inc. | Visitor statistics | DPA signed 15.08.2026, EU version, includes standard contractual clauses |

PostHog's own sub-processors are listed at <https://posthog.com/subprocessors>
(AWS, Wiz, PlanetScale, Modal and Cloudflare as of August 2026). There is no
notification feed, so check that page when reviewing this record.

## Review

Review when the analytics configuration changes, when PostHog changes its
sub-processors, or yearly, whichever comes first. `/tmp/e2e/privacy.mjs` tests
the public claims in a real browser and is the fastest way to confirm the site
still behaves the way this record says it does.
