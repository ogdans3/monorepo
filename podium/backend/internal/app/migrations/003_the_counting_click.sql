-- A presentation chooses its built-in vote sound: the bell, or the click of a
-- tally counter, whose small tone climbs a step with every vote on the
-- question, the way a count goes up. An uploaded sound, when there is one,
-- plays instead of either.
alter table presentations add column chime text not null default 'bell'
    check (chime in ('bell', 'click'));
