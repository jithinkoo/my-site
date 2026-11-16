import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/portfolio start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :portfolio, PortfolioWeb.Endpoint, server: true
end

config :portfolio, PortfolioWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

if config_env() == :dev do
  # Reload browser tabs when matching files change.
  config :portfolio, PortfolioWeb.Endpoint,
    live_reload: [
      web_console_logger: true,
      patterns: [
        # Static assets, except user uploads
        ~r"priv/static/(?!uploads/).*\.(js|css|png|jpeg|jpg|gif|svg)$"E,
        # Router, Controllers, LiveViews and LiveComponents
        ~r"lib/portfolio_web/router\.ex$"E,
        ~r"lib/portfolio_web/(controllers|live|components)/.*\.(ex|heex)$"E
      ]
    ]
end

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  # Hosted URLs (e.g. Neon) end in "?sslmode=require&channel_binding=require".
  # Ecto doesn't use those parameters; SSL is configured below instead.
  db_uri = URI.parse(database_url)
  database_url = URI.to_string(%{db_uri | query: nil})

  # DATABASE_SSL:
  #   "verify" (default) - encrypted, and the server certificate is checked.
  #                        Right for Neon and other public hosted databases.
  #   "require"          - encrypted, certificate not checked.
  #   "false"            - no SSL (database on the same private network only).
  ssl_opts =
    case System.get_env("DATABASE_SSL", "verify") do
      "verify" ->
        [
          ssl: [
            verify: :verify_peer,
            cacerts: :public_key.cacerts_get(),
            server_name_indication: String.to_charlist(db_uri.host),
            customize_hostname_check: [
              match_fun: :public_key.pkix_verify_hostname_match_fun(:https)
            ]
          ]
        ]

      "require" ->
        [ssl: [verify: :verify_none, server_name_indication: String.to_charlist(db_uri.host)]]

      "false" ->
        []

      other ->
        raise "DATABASE_SSL must be verify, require or false (got #{inspect(other)})"
    end

  config :portfolio, Portfolio.Repo,
    url: database_url,
    # Free database tiers allow very few connections; 2 is plenty for a blog.
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "2"),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  config :portfolio, Portfolio.Repo, ssl_opts

  admin_password =
    System.get_env("ADMIN_PASSWORD") ||
      raise """
      environment variable ADMIN_PASSWORD is missing.
      Set a long, unique password (12+ characters) for /admin.
      """

  if String.length(admin_password) < 12 do
    raise "ADMIN_PASSWORD must be at least 12 characters long."
  end

  config :portfolio, admin_password: admin_password

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :portfolio, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :portfolio, PortfolioWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Listen on all IPv4 interfaces. Not every host has IPv6; binding to
      # it where it's missing stops the app from starting (:eafnosupport).
      # Set BIND_IPV6=true on hosts that need IPv6 (e.g. Fly.io).
      ip:
        if(System.get_env("BIND_IPV6") in ~w(true 1),
          do: {0, 0, 0, 0, 0, 0, 0, 0},
          else: {0, 0, 0, 0}
        )
    ],
    secret_key_base: secret_key_base

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :portfolio, PortfolioWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://plug.hexdocs.pm/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :portfolio, PortfolioWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
