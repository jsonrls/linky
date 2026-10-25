-- Private immutable photos. No draft, publication, account or existing object data is rewritten.
begin;

create function private.valid_avatar_path(value text) returns boolean language sql immutable set search_path='' as $$
  select coalesce(value ~ '^/api/profile-photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and length(value)=93, false);
$$;
revoke all on function private.valid_avatar_path(text) from public, anon, authenticated, service_role;

create or replace function private.validate_document(doc jsonb, publishing boolean default false) returns void language plpgsql set search_path='' as $$
declare block jsonb; seen uuid[] := '{}'::uuid[]; block_id uuid; visible_count integer := 0; media_field text;
begin
  if doc is null or jsonb_typeof(doc) <> 'object' or octet_length(doc::text)>262144
    or (doc - array['schemaVersion','name','bio','appearance','blocks']) <> '{}'::jsonb
    or doc->'schemaVersion' is distinct from '1'::jsonb or not doc ?& array['schemaVersion','name','bio','appearance','blocks']
    or jsonb_typeof(doc->'name') <> 'string' or length(doc->>'name')>80
    or jsonb_typeof(doc->'bio') <> 'string' or length(doc->>'bio')>300
    or jsonb_typeof(doc->'appearance') <> 'object'
    or not (doc->'appearance') ?& array['theme','layout','shape']
    or ((doc->'appearance') - array['theme','layout','shape','template','avatarUrl','coverUrl']) <> '{}'::jsonb
    or ((doc->'appearance'->>'theme') = any(array['warm','ink'])) is distinct from true
    or ((doc->'appearance'->>'layout') = any(array['editorial','compact'])) is distinct from true
    or ((doc->'appearance'->>'shape') = any(array['soft','square'])) is distinct from true
    or ((doc->'appearance') ? 'template' and (jsonb_typeof(doc->'appearance'->'template') is distinct from 'string'
      or ((doc->'appearance'->>'template') = any(array['original','electric-index','soft-motion','contact-sheet','cobalt-objects','studio-index','sunday-kitchen','quiet-cadence','lift-log','open-house','garden-dispatch','night-shift','route-postcard','the-big-question','objects-and-hands','distance-club','screening-room','type-practice','soft-power','culture-receipt','coastal-assembly'])) is distinct from true))
    or jsonb_typeof(doc->'blocks') <> 'array'
  then raise exception using message='invalid_document', errcode='P0001'; end if;
  foreach media_field in array array['avatarUrl','coverUrl'] loop
    if (doc->'appearance') ? media_field then
      if jsonb_typeof(doc->'appearance'->media_field) is distinct from 'string' or length(doc->'appearance'->>media_field)>2048
      then raise exception using message='invalid_document', errcode='P0001'; end if;
      if publishing and length(btrim(doc->'appearance'->>media_field))>0
        and not (media_field='avatarUrl' and private.valid_avatar_path(doc->'appearance'->>media_field))
        and ((doc->'appearance'->>media_field) !~* '^https://' or not private.valid_url(doc->'appearance'->>media_field))
      then raise exception using message='invalid_media_url', errcode='P0001'; end if;
    end if;
  end loop;
  if jsonb_array_length(doc->'blocks')>100 then raise exception using message='invalid_document', errcode='P0001'; end if;
  for block in select value from jsonb_array_elements(doc->'blocks') loop
    if jsonb_typeof(block)<>'object' or not block ?& array['id','type','visible']
      or jsonb_typeof(block->'visible')<>'boolean'
      or ((block->>'type') = any(array['link','text'])) is distinct from true
      or (block - case when block->>'type'='link' then array['id','type','visible','label','url','imageUrl'] else array['id','type','visible','text'] end) <> '{}'::jsonb
    then raise exception using message='invalid_document', errcode='P0001'; end if;
    begin block_id := (block->>'id')::uuid;
    exception when invalid_text_representation then raise exception using message='invalid_document', errcode='P0001'; end;
    if block_id is null or block_id=any(seen) then raise exception using message='invalid_document', errcode='P0001'; end if;
    seen := array_append(seen,block_id);
    if block->>'type'='link' then
      if not block ?& array['label','url'] or jsonb_typeof(block->'label')<>'string' or length(block->>'label')>120
        or jsonb_typeof(block->'url')<>'string' or length(block->>'url')>2048
      then raise exception using message='invalid_document', errcode='P0001'; end if;
      if block ? 'imageUrl' and (jsonb_typeof(block->'imageUrl') is distinct from 'string' or length(block->>'imageUrl')>2048)
      then raise exception using message='invalid_document', errcode='P0001'; end if;
      if publishing and (block->>'visible')::boolean and (length(btrim(block->>'label'))=0 or not private.valid_url(block->>'url'))
      then raise exception using message='invalid_visible_link', errcode='P0001'; end if;
      if publishing and (block->>'visible')::boolean and length(btrim(block->>'imageUrl'))>0
        and ((block->>'imageUrl') !~* '^https://' or not private.valid_url(block->>'imageUrl'))
      then raise exception using message='invalid_media_url', errcode='P0001'; end if;
    else
      if not block ? 'text' or jsonb_typeof(block->'text')<>'string' or length(block->>'text')>2000
      then raise exception using message='invalid_document', errcode='P0001'; end if;
      if publishing and (block->>'visible')::boolean and length(btrim(block->>'text'))=0
      then raise exception using message='invalid_visible_text', errcode='P0001'; end if;
    end if;
    if (block->>'visible')::boolean then visible_count:=visible_count+1; end if;
  end loop;
  if publishing and (length(btrim(doc->>'name'))=0 or visible_count=0)
  then raise exception using message='incomplete_profile', errcode='P0001'; end if;
end;
$$;

-- The caller's verified JWT supplies auth.uid(); callers cannot supply an owner ID.
create function private.can_read_profile_photo(profile uuid, asset uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from private.profiles p
    join private.accounts a on a.id=p.owner_id and a.status='active'
    join auth.users u on u.id=a.id and u.email_confirmed_at is not null
    left join private.profile_publications pub on pub.id=p.current_publication_id and pub.profile_id=p.id
    where p.id=$1 and (
      p.owner_id=(select auth.uid())
      or pub.payload->'appearance'->>'avatarUrl'='/api/profile-photos/' || $1::text || '/' || $2::text
    )
  );
$$;
create function public.can_read_profile_photo(profile uuid, asset uuid) returns boolean
language sql stable security invoker set search_path='' as $$ select private.can_read_profile_photo(profile,asset); $$;
revoke all on function private.can_read_profile_photo(uuid,uuid), public.can_read_profile_photo(uuid,uuid) from public, anon, authenticated, service_role;
grant usage on schema private to anon;
grant execute on function private.can_read_profile_photo(uuid,uuid), public.can_read_profile_photo(uuid,uuid) to anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',false,3145728,array['image/webp']);
-- Restrictive policy also blocks future broad permissive policies from exposing this bucket.
create policy profile_photos_server_only on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'profile-photos') with check (bucket_id <> 'profile-photos');

commit;
