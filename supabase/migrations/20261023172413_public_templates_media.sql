-- Add optional template/media data without rewriting existing drafts or snapshots.
-- CREATE OR REPLACE retains the existing function ownership and execute grants.
begin;

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

-- Preserve the owner/account locks, revision checks and receipt semantics verbatim.
create or replace function private.mutate_profile(kind text, operation_id uuid, profile uuid default null, expected_revision integer default null, body jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  account private.accounts; p private.profiles; d private.profile_drafts;
  request jsonb; receipt private.operation_receipts; result jsonb; new_id uuid;
  payload jsonb; normalized_handle text;
begin
  account:=private.require_account();
  if kind is null or kind<>all(array['create','save','publish','unpublish']) or operation_id is null or body is null
    or (kind<>'create' and (profile is null or expected_revision is null or expected_revision<0))
  then raise exception using message='invalid_request',errcode='P0001'; end if;
  request:=jsonb_build_object('kind',kind,'profile',profile,'revision',expected_revision,'body',body);
  select * into receipt from private.operation_receipts r where r.owner_id=account.id and r.operation_id=mutate_profile.operation_id;
  if found then
    if receipt.request<>request then raise exception using message='idempotency_conflict',errcode='P0001'; end if;
    return receipt.result;
  end if;
  if kind='create' then
    if (body - array['label','name','handle'])<>'{}'::jsonb or not body ?& array['label','name','handle']
      or jsonb_typeof(body->'name')<>'string' or length(btrim(body->>'name')) not between 1 and 80
    then raise exception using message='invalid_request',errcode='P0001'; end if;
    if (select count(*) from private.profiles where owner_id=account.id)>=account.profile_limit then raise exception using message='profile_limit',errcode='P0001'; end if;
  else
    select * into p from private.profiles where id=profile and owner_id=account.id for update;
    if not found then raise exception using message='not_found',errcode='P0001'; end if;
    select * into d from private.profile_drafts where profile_id=profile;
    if d.revision<>expected_revision then raise exception using message='revision_conflict',errcode='P0001'; end if;
  end if;
  if kind in ('create','save') then
    if jsonb_typeof(body->'label') is distinct from 'string' or length(btrim(body->>'label')) not between 1 and 80
      or jsonb_typeof(body->'handle') is distinct from 'string'
    then raise exception using message='invalid_request',errcode='P0001'; end if;
    normalized_handle:=lower(btrim(body->>'handle'));
    if not private.valid_handle(normalized_handle) then raise exception using message='invalid_handle',errcode='P0001'; end if;
    if kind='save' and p.first_published_at is not null and p.handle<>normalized_handle then raise exception using message='handle_locked',errcode='P0001'; end if;
  end if;
  if kind='create' then
    insert into private.profiles(owner_id,label,handle) values(account.id,btrim(body->>'label'),normalized_handle) returning id into profile;
    insert into private.profile_drafts(profile_id,document) values(profile,jsonb_build_object('schemaVersion',1,'name',btrim(body->>'name'),'bio','','appearance',jsonb_build_object('theme','warm','layout','editorial','shape','soft'),'blocks','[]'::jsonb));
  elsif kind='save' then
    if (body - array['label','handle','document'])<>'{}'::jsonb or not body ?& array['label','handle','document'] then raise exception using message='invalid_request',errcode='P0001'; end if;
    perform private.validate_document(body->'document');
    update private.profiles set label=btrim(body->>'label'),handle=normalized_handle,updated_at=clock_timestamp() where id=profile;
    update private.profile_drafts set document=body->'document',revision=revision+1 where profile_id=profile;
  elsif kind='publish' then
    if body<>'{}'::jsonb then raise exception using message='invalid_request',errcode='P0001'; end if;
    perform private.validate_document(d.document,true);
    if p.current_publication_id is null and (select count(*) from private.profiles where owner_id=account.id and current_publication_id is not null)>=account.published_limit
    then raise exception using message='published_limit',errcode='P0001'; end if;
    select jsonb_build_object('schemaVersion',1,'name',d.document->>'name','bio',d.document->>'bio','appearance',d.document->'appearance',
      'blocks',coalesce(jsonb_agg(case when b->>'type'='link' then (jsonb_build_object('id',b->>'id','type','link','visible',true,'label',b->>'label','url',b->>'url')
        || case when b ? 'imageUrl' then jsonb_build_object('imageUrl',b->>'imageUrl') else '{}'::jsonb end)
      else jsonb_build_object('id',b->>'id','type','text','visible',true,'text',b->>'text') end order by ord),'[]'::jsonb)) into payload
      from jsonb_array_elements(d.document->'blocks') with ordinality as blocks(b,ord) where (b->>'visible')::boolean;
    insert into private.profile_publications(profile_id,source_revision,payload) values(profile,d.revision,payload) returning id into new_id;
    update private.profiles set current_publication_id=new_id,first_published_at=coalesce(first_published_at,clock_timestamp()),updated_at=clock_timestamp() where id=profile;
  else
    if body<>'{}'::jsonb then raise exception using message='invalid_request',errcode='P0001'; end if;
    update private.profiles set current_publication_id=null,updated_at=clock_timestamp() where id=profile;
  end if;
  result:=private.profile_result(profile);
  insert into private.operation_receipts(owner_id,operation_id,request,result) values(account.id,operation_id,request,result);
  return result;
exception when unique_violation then raise exception using message='handle_taken',errcode='P0001';
end;
$$;

commit;
