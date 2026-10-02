-- A presentation, its slides, the answer options on a question slide, the
-- votes on them, and the pictures, videos and sounds it carries.

create table presentations (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    -- What the audience types or scans: short, and nothing in it that reads as
    -- two different letters on a projector (no 0/O, 1/I/L).
    code text not null unique,
    -- The slide on screen, or none while the presentation is not running.
    live_slide_id uuid,
    -- An uploaded sound played for each vote instead of the built-in chime.
    sound_media_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table media (
    id uuid primary key default gen_random_uuid(),
    presentation_id uuid not null references presentations (id) on delete cascade,
    kind text not null check (kind in ('image', 'video', 'audio')),
    mime text not null,
    size bigint not null,
    original_name text not null default '',
    created_at timestamptz not null default now()
);

create table slides (
    id uuid primary key default gen_random_uuid(),
    presentation_id uuid not null references presentations (id) on delete cascade,
    position integer not null,
    -- What the ballot asks on a question slide, and the slide's name in the list.
    title text not null default '',
    background text not null default '#111418',
    -- Text, pictures, videos and QR codes, each placed on the 16:9 stage in
    -- percent of its width and height. Validated by the API, not here.
    elements jsonb not null default '[]',
    created_at timestamptz not null default now()
);

create index slides_by_presentation on slides (presentation_id, position);

-- A question's answers, each a place on the slide the presenter chose. Kept as
-- rows rather than in `elements` because votes point at them.
create table options (
    id uuid primary key default gen_random_uuid(),
    slide_id uuid not null references slides (id) on delete cascade,
    position integer not null,
    label text not null default '',
    x double precision not null,
    y double precision not null,
    w double precision not null,
    h double precision not null
);

create index options_by_slide on options (slide_id, position);

-- One vote per phone per question: `voter` is the phone's cookie.
create table votes (
    id bigserial primary key,
    slide_id uuid not null references slides (id) on delete cascade,
    option_id uuid not null references options (id) on delete cascade,
    voter text not null,
    created_at timestamptz not null default now(),
    unique (slide_id, voter)
);

create index votes_by_option on votes (option_id);

alter table presentations
    add constraint presentations_live_slide
        foreign key (live_slide_id) references slides (id) on delete set null,
    add constraint presentations_sound
        foreign key (sound_media_id) references media (id) on delete set null;
