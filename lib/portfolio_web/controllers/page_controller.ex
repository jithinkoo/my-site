defmodule PortfolioWeb.PageController do
  use PortfolioWeb, :controller

  alias Portfolio.Blog

  def home(conn, _params) do
    render(conn, :home,
      posts: Blog.list_published_posts(limit: 5),
      comment_counts: Blog.comment_counts(),
      quiz_high: Portfolio.Quiz.high_score(),
      quiz_count: min(Portfolio.Quiz.active_question_count(), 20),
      meta_description: PortfolioWeb.Seo.snippet(conn.assigns.profile.intro, 200)
    )
  end

  def about(conn, _params) do
    render(conn, :about,
      page_title: "About",
      meta_description: PortfolioWeb.Seo.snippet(conn.assigns.profile.about, 200)
    )
  end
end
