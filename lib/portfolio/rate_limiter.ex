defmodule Portfolio.RateLimiter do
  @moduledoc """
  A tiny in-memory limiter for visitor comments: at most `limit` actions per
  `window` for one visitor key. Keys are SHA-256 hashes, so no IP address
  is ever stored, and everything is forgotten after the window (or a restart).
  """
  use GenServer

  @table :portfolio_rate_limiter

  def start_link(_opts), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @doc "Returns :ok and counts the action, or {:error, :rate_limited}."
  def hit(key, limit, window_ms) do
    hashed = :crypto.hash(:sha256, to_string(key))
    now = System.monotonic_time(:millisecond)

    recent =
      case :ets.lookup(@table, hashed) do
        [{_, stamps}] -> Enum.filter(stamps, &(now - &1 < window_ms))
        [] -> []
      end

    if length(recent) >= limit do
      :ets.insert(@table, {hashed, recent})
      {:error, :rate_limited}
    else
      :ets.insert(@table, {hashed, [now | recent]})
      :ok
    end
  end

  def reset, do: :ets.delete_all_objects(@table)

  @impl true
  def init(nil) do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    schedule_cleanup()
    {:ok, nil}
  end

  @impl true
  def handle_info(:cleanup, state) do
    # Drop everything older than an hour.
    cutoff = System.monotonic_time(:millisecond) - 3_600_000

    for {key, stamps} <- :ets.tab2list(@table), Enum.all?(stamps, &(&1 < cutoff)) do
      :ets.delete(@table, key)
    end

    schedule_cleanup()
    {:noreply, state}
  end

  defp schedule_cleanup, do: Process.send_after(self(), :cleanup, 600_000)
end
