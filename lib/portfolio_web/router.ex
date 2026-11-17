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
    get "/thoughts", PostController, :index
    get "/thoughts/:slug", PostController, :show
  end

  scope "/", PortfolioWeb do
    get "/feed.xml", FeedController, :index
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
    resources "/images", ImageController, only: [:index, :create, :delete]
    get "/profile", ProfileController, :edit
    put "/profile", ProfileController, :update
  end

  defp load_profile(conn, _opts) do
    Plug.Conn.assign(conn, :profile, Portfolio.Profiles.get_profile())
  end

  defp put_noindex(conn, _opts) do
    conn
    |> Plug.Conn.assign(:noindex, true)
    |> Plug.Conn.put_resp_header("x-robots-tag", "noindex, nofollow")
  end
end
