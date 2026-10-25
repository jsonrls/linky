begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select set_config('test.document','{"schemaVersion":1,"name":"Template owner","bio":"","appearance":{"theme":"warm","layout":"editorial","shape":"soft"},"blocks":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","type":"link","visible":true,"label":"Work","url":"https://example.com"}]}',true);
select lives_ok(format('select private.validate_document(%L::jsonb,true)',current_setting('test.document')),'legacy document still publishes without template/media');

select throws_ok(format('select private.validate_document(%L::jsonb)',jsonb_set(current_setting('test.document')::jsonb,array['appearance',field],value)),'P0001','invalid_document',description)
from (values
  ('template','null'::jsonb,'null template rejected'),
  ('template','1'::jsonb,'numeric template rejected'),
  ('template','"unknown-template"'::jsonb,'unknown template ID rejected'),
  ('avatarUrl','null'::jsonb,'null avatar rejected'),
  ('avatarUrl','[]'::jsonb,'array avatar rejected'),
  ('coverUrl','false'::jsonb,'boolean cover rejected'),
  ('coverUrl','null'::jsonb,'null cover rejected'),
  ('avatarUrl',to_jsonb(repeat('x',2049)),'oversized avatar rejected'),
  ('coverUrl',to_jsonb(repeat('x',2049)),'oversized cover rejected'),
  ('unknown','"value"'::jsonb,'unknown appearance field rejected')
) as cases(field,value,description);

select throws_ok(format('select private.validate_document(%L::jsonb)',jsonb_set(current_setting('test.document')::jsonb,'{blocks,0,imageUrl}',value)),'P0001','invalid_document',description)
from (values
  ('null'::jsonb,'null link image rejected'),
  ('1'::jsonb,'numeric link image rejected'),
  ('[]'::jsonb,'array link image rejected'),
  (to_jsonb(repeat('x',2049)),'oversized link image rejected')
) as cases(value,description);
select throws_ok(format('select private.validate_document(%L::jsonb)',jsonb_set(current_setting('test.document')::jsonb,'{blocks,0}','{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","type":"text","visible":true,"text":"Hello","imageUrl":""}'::jsonb)),'P0001','invalid_document','text blocks cannot carry image fields');

select lives_ok(format('select private.validate_document(%L::jsonb)',jsonb_set(current_setting('test.document')::jsonb,'{appearance,avatarUrl}',to_jsonb(repeat('x',2048)))),'maximum length incomplete image autosaves as draft');
select lives_ok(format('select private.validate_document(%L::jsonb,true)',jsonb_set(jsonb_set(current_setting('test.document')::jsonb,'{appearance,avatarUrl}','""'),'{blocks,0,imageUrl}','" "')),'blank optional media publishes');
select throws_ok(format('select private.validate_document(%L::jsonb,true)',jsonb_set(current_setting('test.document')::jsonb,'{appearance,avatarUrl}',to_jsonb(url))),'P0001','invalid_media_url',description)
from (values
  ('unfinished','incomplete avatar cannot publish'),
  ('http://example.com/image.jpg','HTTP avatar cannot publish'),
  ('https://user:pass@example.com/image.jpg','credentialed avatar cannot publish'),
  ('https://example.com:99999/image.jpg','invalid image port cannot publish')
) as cases(url,description);
select throws_ok(format('select private.validate_document(%L::jsonb,true)',jsonb_set(current_setting('test.document')::jsonb,'{appearance,coverUrl}','"unfinished"')),'P0001','invalid_media_url','invalid cover cannot publish');
select throws_ok(format('select private.validate_document(%L::jsonb,true)',jsonb_set(current_setting('test.document')::jsonb,'{blocks,0,imageUrl}','"unfinished"')),'P0001','invalid_media_url','invalid visible link image cannot publish');
select lives_ok(format('select private.validate_document(%L::jsonb,true)',jsonb_set(current_setting('test.document')::jsonb,'{blocks}',(current_setting('test.document')::jsonb->'blocks') || '[{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","type":"link","visible":false,"label":"","url":"","imageUrl":"unfinished"}]'::jsonb)),'hidden incomplete image and link do not block publication');

select * from finish();
rollback;
