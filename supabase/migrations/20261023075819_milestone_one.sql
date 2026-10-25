-- Domain tables are deliberately outside the exposed Data API schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create table private.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','deleting')),
  published_limit integer not null default 2 check (published_limit between 0 and 100),
  profile_limit integer not null default 30 check (profile_limit between 1 and 100),
  created_at timestamptz not null default now()
);
create table private.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references private.accounts(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  handle text not null unique,
  first_published_at timestamptz,
  current_publication_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$')
);
create index profiles_owner_updated on private.profiles(owner_id, updated_at desc, id);
create table private.profile_drafts (
  profile_id uuid primary key references private.profiles(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  document jsonb not null check (octet_length(document::text) <= 262144)
);
create table private.profile_publications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references private.profiles(id) on delete cascade,
  source_revision integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (profile_id, id)
);
alter table private.profiles add constraint current_publication_belongs_to_profile
  foreign key (id,current_publication_id) references private.profile_publications(profile_id,id) deferrable initially deferred;
create table private.operation_receipts (
  owner_id uuid not null references private.accounts(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id,operation_id)
);

alter table private.accounts enable row level security;
alter table private.profiles enable row level security;
alter table private.profile_drafts enable row level security;
alter table private.profile_publications enable row level security;
alter table private.operation_receipts enable row level security;
create policy owner_account on private.accounts to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy owner_profile on private.profiles to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy owner_draft on private.profile_drafts to authenticated using (exists(select 1 from private.profiles p where p.id=profile_id and p.owner_id=(select auth.uid()))) with check (exists(select 1 from private.profiles p where p.id=profile_id and p.owner_id=(select auth.uid())));
create policy owner_publication on private.profile_publications to authenticated using (exists(select 1 from private.profiles p where p.id=profile_id and p.owner_id=(select auth.uid())));
create policy owner_receipt on private.operation_receipts to authenticated using (owner_id=(select auth.uid()));
revoke all on all tables in schema private from public, anon, authenticated, service_role;

create function private.valid_handle(value text) returns boolean language sql immutable set search_path='' as $$
  select value ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and value <> all(array['admin','api','app','auth','billing','help','login','logout','privacy','settings','signup','support','terms','www','linky']);
$$;
create function private.valid_url(value text) returns boolean language plpgsql immutable set search_path='' as $$
declare parts text[]; host text; address inet;
begin
  if value is null or length(value)>2048 or value ~ '[[:cntrl:][:space:]\\]' then return false; end if;
  parts:=regexp_match(value,'^https?://(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:([0-9]{1,5}))?([/?#].*)?$','i');
  if parts is null then return false; end if;
  host:=parts[1];
  if parts[3] is not null and parts[3]::integer not between 1 and 65535 then return false; end if;
  if left(host,1)='[' then
    address:=substring(host from 2 for length(host)-2)::inet;
    return family(address)=6;
  end if;
  if host ~ '^[0-9.]+$' then
    if host !~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' then return false; end if;
    address:=host::inet;
    return family(address)=4;
  end if;
  return length(host)<=253 and host ~* '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$';
exception when invalid_text_representation then return false;
end;
$$;
create function private.validate_document(doc jsonb, publishing boolean default false) returns void language plpgsql set search_path='' as $$
declare block jsonb; seen uuid[] := '{}'::uuid[]; block_id uuid; visible_count integer := 0;
begin
  if doc is null or jsonb_typeof(doc) <> 'object' or octet_length(doc::text)>262144
    or (doc - array['schemaVersion','name','bio','appearance','blocks']) <> '{}'::jsonb
    or doc->'schemaVersion' is distinct from '1'::jsonb or not doc ?& array['schemaVersion','name','bio','appearance','blocks']
    or jsonb_typeof(doc->'name') <> 'string' or length(doc->>'name')>80
    or jsonb_typeof(doc->'bio') <> 'string' or length(doc->>'bio')>300
    or jsonb_typeof(doc->'appearance') <> 'object'
    or not (doc->'appearance') ?& array['theme','layout','shape']
    or ((doc->'appearance') - array['theme','layout','shape']) <> '{}'::jsonb
    or ((doc->'appearance'->>'theme') = any(array['warm','ink'])) is distinct from true
    or ((doc->'appearance'->>'layout') = any(array['editorial','compact'])) is distinct from true
    or ((doc->'appearance'->>'shape') = any(array['soft','square'])) is distinct from true
    or jsonb_typeof(doc->'blocks') <> 'array'
  then raise exception using message='invalid_document', errcode='P0001'; end if;
  if jsonb_array_length(doc->'blocks')>100 then raise exception using message='invalid_document', errcode='P0001'; end if;
  for block in select value from jsonb_array_elements(doc->'blocks') loop
    if jsonb_typeof(block)<>'object' or not block ?& array['id','type','visible']
      or jsonb_typeof(block->'visible')<>'boolean'
      or ((block->>'type') = any(array['link','text'])) is distinct from true
      or (block - case when block->>'type'='link' then array['id','type','visible','label','url'] else array['id','type','visible','text'] end) <> '{}'::jsonb
    then raise exception using message='invalid_document', errcode='P0001'; end if;
    begin block_id := (block->>'id')::uuid;
    exception when invalid_text_representation then raise exception using message='invalid_document', errcode='P0001'; end;
    if block_id is null or block_id=any(seen) then raise exception using message='invalid_document', errcode='P0001'; end if;
    seen := array_append(seen,block_id);
    if block->>'type'='link' then
      if not block ?& array['label','url'] or jsonb_typeof(block->'label')<>'string' or length(block->>'label')>120
        or jsonb_typeof(block->'url')<>'string' or length(block->>'url')>2048
      then raise exception using message='invalid_document', errcode='P0001'; end if;
      if publishing and (block->>'visible')::boolean and (length(btrim(block->>'label'))=0 or not private.valid_url(block->>'url'))
      then raise exception using message='invalid_visible_link', errcode='P0001'; end if;
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

-- All owner operations acquire this account lock before any profile lock.
-- A verified email creates the account once; suspended/deleting accounts cannot recreate it.
create function private.require_account() returns private.accounts language plpgsql security definer set search_path='' as $$
declare account private.accounts;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
  then raise exception using message='unauthenticated', errcode='P0001'; end if;
  insert into private.accounts(id) values(auth.uid()) on conflict do nothing;
  select * into account from private.accounts where id=auth.uid() for update;
  if account.status <> 'active' then raise exception using message='account_unavailable', errcode='P0001'; end if;
  return account;
end;
$$;
create function private.profile_result(profile uuid) returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('id',p.id,'label',p.label,'handle',p.handle,'firstPublishedAt',p.first_published_at,
    'publicationId',p.current_publication_id,'publishedRevision',pub.source_revision,'updatedAt',p.updated_at,
    'revision',d.revision,'document',d.document)
  from private.profiles p join private.profile_drafts d on d.profile_id=p.id
  left join private.profile_publications pub on pub.id=p.current_publication_id where p.id=profile;
$$;
create function private.owner_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
declare account private.accounts; result jsonb;
begin
  account:=private.require_account();
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'label',p.label,'name',d.document->>'name',
    'handle',p.handle,'firstPublishedAt',p.first_published_at,'publicationId',p.current_publication_id,
    'publishedRevision',pub.source_revision,'revision',d.revision,'updatedAt',p.updated_at)
    order by p.updated_at desc,p.id),'[]'::jsonb) into result
    from private.profiles p join private.profile_drafts d on d.profile_id=p.id
    left join private.profile_publications pub on pub.id=p.current_publication_id where p.owner_id=account.id;
  return jsonb_build_object('ownerId',account.id,'publishedLimit',account.published_limit,'profileLimit',account.profile_limit,'profiles',result);
end;
$$;
create function private.read_profile(profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare account private.accounts;
begin
  account:=private.require_account();
  if not exists(select 1 from private.profiles where id=profile and owner_id=account.id) then raise exception using message='not_found',errcode='P0001'; end if;
  return private.profile_result(profile);
end;
$$;
create function private.handle_available(handle text) returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform private.require_account();
  return private.valid_handle($1) and not exists(select 1 from private.profiles p where p.handle=$1);
end;
$$;

-- Receipt lookup happens under the account lock and before checking revisions.
-- A changed request with a reused ID is rejected rather than silently replayed.
create function private.mutate_profile(kind text, operation_id uuid, profile uuid default null, expected_revision integer default null, body jsonb default '{}'::jsonb)
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
      'blocks',coalesce(jsonb_agg(case when b->>'type'='link' then jsonb_build_object('id',b->>'id','type','link','visible',true,'label',b->>'label','url',b->>'url')
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
create function private.public_profile(handle text) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('handle',p.handle,'publicationId',pub.id,'document',pub.payload)
    from private.profiles p join private.accounts a on a.id=p.owner_id and a.status='active'
    join private.profile_publications pub on pub.id=p.current_publication_id and pub.profile_id=p.id where p.handle=$1;
$$;

-- The only exposed surface consists of invoker wrappers with explicit grants.
create function public.owner_workspace() returns jsonb language sql security invoker set search_path='' as $$ select private.owner_workspace(); $$;
create function public.read_profile(profile uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.read_profile(profile); $$;
create function public.handle_available(handle text) returns boolean language sql security invoker set search_path='' as $$ select private.handle_available(handle); $$;
create function public.mutate_profile(kind text,operation_id uuid,profile uuid default null,expected_revision integer default null,body jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.mutate_profile(kind,operation_id,profile,expected_revision,body); $$;
create function public.public_profile(handle text) returns jsonb language sql security invoker set search_path='' as $$ select private.public_profile(handle); $$;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
revoke all on function public.owner_workspace(),public.read_profile(uuid),public.handle_available(text),public.mutate_profile(text,uuid,uuid,integer,jsonb),public.public_profile(text) from public,anon,authenticated,service_role;
grant execute on function private.owner_workspace(),private.read_profile(uuid),private.handle_available(text),private.mutate_profile(text,uuid,uuid,integer,jsonb) to authenticated;
grant execute on function public.owner_workspace(),public.read_profile(uuid),public.handle_available(text),public.mutate_profile(text,uuid,uuid,integer,jsonb) to authenticated;
grant execute on function private.public_profile(text),public.public_profile(text) to service_role;

create function private.reject_publication_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception using message='immutable_publication',errcode='P0001'; end;
$$;
revoke all on function private.reject_publication_change() from public,anon,authenticated,service_role;
create trigger publication_immutable before update on private.profile_publications for each row execute function private.reject_publication_change();
