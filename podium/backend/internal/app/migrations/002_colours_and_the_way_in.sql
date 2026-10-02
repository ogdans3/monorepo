-- Every answer has a colour: its tile's on the phones and its mark's on the
-- slide, so the room can match one to the other at a glance. A presentation
-- marks its answers with letters or numbers besides, for anyone who cannot
-- tell two colours apart.
alter table options add column color text not null default '';
alter table presentations add column marks text not null default 'letters'
    check (marks in ('letters', 'numbers'));

update options set color =
    (array['#D0273A', '#2A68CF', '#1D8452', '#7448C8', '#0C7F8E', '#BB2F82', '#8E5A35', '#56677D'])[(position % 8) + 1];

-- Every presentation opens with the way in: its title, and the code to scan,
-- big. A presentation made from here on is made with one.
update slides set position = position + 1;
insert into slides (presentation_id, position, title, background, elements)
select p.id, 0, '', '#111418', jsonb_build_array(
    jsonb_build_object('id', 'join-title', 'type', 'text', 'x', 6.25, 'y', 27.778, 'w', 56.25, 'h', 33.333,
        'text', p.title, 'size', 11, 'weight', 700, 'align', 'left'),
    jsonb_build_object('id', 'join-text', 'type', 'text', 'x', 6.25, 'y', 66.667, 'w', 50, 'h', 11.111,
        'text', 'Skann koden og stem underveis.', 'size', 4, 'weight', 400, 'align', 'left'),
    jsonb_build_object('id', 'join-code', 'type', 'qr', 'x', 68.75, 'y', 16.667, 'w', 25, 'h', 66.667))
from presentations p;

-- The code a question slide used to start with, large in the top right, is
-- the small one in the corner now, as on every other slide.
update slides set elements = (
    select jsonb_agg(case when e->>'id' = 'q-code'
        then e || '{"x": 87.5, "y": 5.556, "w": 9.375, "h": 22.222}'::jsonb else e end order by i)
    from jsonb_array_elements(elements) with ordinality as t(e, i))
where elements @> '[{"id": "q-code", "x": 77, "y": 8, "w": 17, "h": 44}]';

-- And every slide without a code gets the small one in its corner, which the
-- presenter can take off.
update slides set elements = elements || jsonb_build_array(jsonb_build_object(
    'id', 'corner-code', 'type', 'qr', 'x', 87.5, 'y', 5.556, 'w', 9.375, 'h', 22.222))
where not elements @> '[{"type": "qr"}]';
