alter table blog_posts
  add column author_title text;

alter table blog_posts
  add constraint blog_posts_author_title_check check (
    author_title is null
    or author_title in ('Mr.', 'Ms.', 'Mrs.', 'Miss', 'Dr.')
  );

do $$
declare
  existing text;
begin
  select conname into existing
  from pg_constraint
  where conrelid = 'blog_posts'::regclass
    and contype = 'c'
    and conname = 'blog_posts_author_len';
  if existing is not null then
    execute format('alter table blog_posts drop constraint %I', existing);
  end if;
end
$$;

alter table blog_posts
  add constraint blog_posts_author_len check (char_length(author) <= 100);
