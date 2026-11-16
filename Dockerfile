# Production image for the site. Works on Render (free, no card) and any
# Docker host. Two stages: build the release, then copy only the release
# into a small runtime image.

# ---------- Build stage ----------
FROM ubuntu:24.04 AS build

ARG OTP_VERSION=28.5.0.8
ARG OTP_SHA256=9d1e254f31554bf26595a6a03164f8e38f48c74d5f60c00b589d581b8ad67781
ARG ELIXIR_VERSION=1.20.4
ARG ELIXIR_SHA256=ea7ff98bc1ed76c663a5d034c863c6fd37e65c9c855b6bbf6ccb2034d806673c

ENV LANG=C.UTF-8 \
    MIX_ENV=prod \
    PATH=/opt/elixir/bin:/opt/erlang/bin:$PATH

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip git openssl libncurses6 \
 && rm -rf /var/lib/apt/lists/*

# Prebuilt Erlang/OTP and Elixir from builds.hex.pm, checksum-verified.
RUN curl -fsSL -o /tmp/otp.tar.gz \
      "https://builds.hex.pm/builds/otp/ubuntu-24.04/OTP-${OTP_VERSION}.tar.gz" \
 && echo "${OTP_SHA256}  /tmp/otp.tar.gz" | sha256sum -c - \
 && mkdir -p /opt/erlang \
 && tar -xzf /tmp/otp.tar.gz -C /opt/erlang --strip-components=1 \
 && /opt/erlang/Install -minimal /opt/erlang > /dev/null \
 && rm /tmp/otp.tar.gz \
 && curl -fsSL -o /tmp/elixir.zip \
      "https://builds.hex.pm/builds/elixir/v${ELIXIR_VERSION}-otp-28.zip" \
 && echo "${ELIXIR_SHA256}  /tmp/elixir.zip" | sha256sum -c - \
 && unzip -q /tmp/elixir.zip -d /opt/elixir \
 && rm /tmp/elixir.zip

WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force

# Dependencies first, so code changes don't re-download them.
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mkdir config
COPY config/config.exs config/prod.exs config/
RUN mix deps.compile

COPY priv priv
COPY lib lib
RUN mix compile

COPY config/runtime.exs config/
COPY rel rel
# Commits made on Windows lose the executable bit on these scripts.
RUN chmod +x rel/overlays/bin/server rel/overlays/bin/migrate \
 && mix release

# ---------- Runtime stage ----------
FROM ubuntu:24.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl libncurses6 libstdc++6 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --shell /usr/sbin/nologin app

ENV LANG=C.UTF-8 \
    MIX_ENV=prod \
    PHX_SERVER=true

WORKDIR /app
COPY --from=build --chown=app:app /app/_build/prod/rel/portfolio ./
USER app

# Render sets PORT (usually 10000); the app reads it in config/runtime.exs.
EXPOSE 4000

# Run any new database migrations, then start the web server.
CMD ["/bin/sh", "-c", "/app/bin/migrate && exec /app/bin/server"]
