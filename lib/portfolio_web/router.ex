defmodule PortfolioWeb.Router do
  use PortfolioWeb, :router

  import PortfolioWeb.AdminAuth, only: [require_admin: 2]

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_flash
    plug :put_root_layout, html: {PortfolioWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :load_profile
  end

  # The quiz talks JSON but still needs the session and CSRF protection.
  pipeline :quiz do
    plug :accepts, ["json"]
    plug :fetch_session
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :noindex do
    plug :put_noindex
  end

  pipeline :admin do
    plug :require_admin
    plug :put_noindex
  end

  scope "/", PortfolioWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/about", PageController, :about
    get "/journey", JourneyController, :index
    get "/thoughts", PostController, :index
    get "/thoughts/:slug", PostController, :show
    get "/stories/:slug", PostController, :show
    get "/places", PostController, :places
    get "/places/:slug", PostController, :show
    post "/posts/:slug/comments", PostController, :create_comment
    get "/gallery", GalleryController, :index
  end

  scope "/quiz", PortfolioWeb do
    pipe_through :quiz

    get "/state", QuizController, :state
    post "/start", QuizController, :start
    post "/answer", QuizController, :answer
    post "/name", QuizController, :name
  end

  scope "/", PortfolioWeb do
    get "/feed.xml", FeedController, :index
    get "/sitemap.xml", SeoController, :sitemap
    get "/robots.txt", SeoController, :robots
    get "/media/:id", MediaController, :show
    get "/health", HealthController, :show
  end

  scope "/admin", PortfolioWeb.Admin, as: :admin do
    pipe_through [:browser, :noindex]

    get "/login", SessionController, :new
    post "/login", SessionController, :create
    delete "/logout", SessionController, :delete
  end

  scope "/admin", PortfolioWeb.Admin, as: :admin do
    pipe_through [:browser, :admin]

    get "/", PostController, :index
    resources "/posts", PostController, except: [:index, :show]
    resources "/images", ImageController, only: [:index, :create, :update, :delete]
    put "/images/:id/slideshow", ImageController, :slideshow
    delete "/comments/:id", CommentController, :delete
    resources "/milestones", MilestoneController, except: [:show]
    resources "/questions", QuestionController, except: [:show]
    delete "/quiz-scores/:id", QuestionController, :delete_score
    get "/profile", ProfileController, :edit
    put "/profile", ProfileController, :update
  end

  defp load_profile(conn, _opts) do
    profile = Portfolio.Profiles.get_profile()

    conn
    |> Plug.Conn.assign(:profile, profile)
    |> Plug.Conn.assign(:slides, Portfolio.Media.slideshow_ids(profile.photo_image_id))
    |> Plug.Conn.assign(:admin?, PortfolioWeb.AdminAuth.admin?(conn))
  end

  defp put_noindex(conn, _opts) do
    conn
    |> Plug.Conn.assign(:noindex, true)
    |> Plug.Conn.put_resp_header("x-robots-tag", "noindex, nofollow")
  end
end
