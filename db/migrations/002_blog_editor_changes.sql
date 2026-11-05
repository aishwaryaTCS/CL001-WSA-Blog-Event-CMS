alter table blog_posts
  add column includes_student boolean not null default false,
  add column author_first_name text not null default '',
  add column author_last_name text not null default '',
  add column author_designation text,
  add column author_grade smallint;

update blog_posts
set includes_student = (photo_consent or name_consent);

alter table blog_posts
  add constraint blog_posts_author_first_name_len check (char_length(author_first_name) <= 24),
  add constraint blog_posts_author_last_name_len check (char_length(author_last_name) <= 24),
  add constraint blog_posts_author_designation_check check (
    author_designation is null
    or author_designation in (
      'Class Teacher',
      'Subject Teacher',
      'Head of Department',
      'Coordinator',
      'Counsellor',
      'Librarian',
      'Sports Coach',
      'Vice Principal',
      'Principal'
    )
  ),
  add constraint blog_posts_author_grade_check check (
    author_grade is null or author_grade between 1 and 10
  );

alter table blog_posts drop constraint blog_posts_seo_title_len;
alter table blog_posts
  add constraint blog_posts_seo_title_len check (seo_title is null or char_length(seo_title) <= 200);

update blog_posts
set seo_title = left(title || ' — Notes from school | Wellsprings Academy', 200)
where seo_title is null;

update blog_posts
set seo_description = excerpt
where seo_description is null and excerpt <> '';
