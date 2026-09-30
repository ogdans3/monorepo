-- Any number of interests, none included.
--
-- Round 5 held 02 to three to five, and this check held the column to it:
-- none, or three to five. The product owner took the limit away on 30.09.2026
-- (docs/DESIGN.md, «Interests»), so one is a choice and so are all twelve, and
-- `PUT /me/interests` no longer counts them. Each category is still there at
-- most once, which the route refuses in words.
ALTER TABLE "users" DROP CONSTRAINT "interests_bounds";
