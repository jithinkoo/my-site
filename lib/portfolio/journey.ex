defmodule Portfolio.Journey do
  @moduledoc "Goals and achievements for the Journey page."

  import Ecto.Query
  alias Portfolio.Repo
  alias Portfolio.Journey.Milestone

  def list(kind) do
    Milestone
    |> where(kind: ^kind)
    |> order_by(asc: :position, desc: :inserted_at)
    |> Repo.all()
  end

  def list_all do
    Milestone
    |> order_by(asc: :kind, asc: :position, desc: :inserted_at)
    |> Repo.all()
  end

  def get!(id), do: Repo.get!(Milestone, id)

  def change(%Milestone{} = m, attrs \\ %{}), do: Milestone.changeset(m, attrs)

  def create(attrs), do: %Milestone{} |> Milestone.changeset(attrs) |> Repo.insert()

  def update(%Milestone{} = m, attrs), do: m |> Milestone.changeset(attrs) |> Repo.update()

  def delete(%Milestone{} = m), do: Repo.delete(m)

  def status_label("dreaming"), do: "Dreaming"
  def status_label("working"), do: "Working on it"
  def status_label("done"), do: "Done"
  def status_label(_), do: nil
end
