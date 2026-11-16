# Adds one sample post so the site doesn't look empty on first run.
# Safe to run more than once. Edit or delete the post from /admin.
#
#     mix run priv/repo/seeds.exs

alias Portfolio.Blog

if Blog.list_all_posts() == [] do
  {:ok, _} =
    Blog.create_post(%{
      title: "Why I started writing",
      summary: "Six years into building software, I wanted a quiet place to think out loud.",
      published: true,
      body: """
      For six years I have been building software. For the last two, most of that work has been in Python.

      Somewhere along the way I noticed that the most useful things I learned were not technical at all. They were about people, patience, and how small habits add up over a long career.

      > Writing is thinking made visible.

      This site is where I will write those things down. Some posts will be short, some long. All of them will be honest.

      Thank you for reading.
      """
    })
end
