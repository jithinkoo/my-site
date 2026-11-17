defmodule Portfolio.Journey.Milestone do
  use Ecto.Schema
  import Ecto.Changeset

  @kinds ~w(achievement goal)
  @statuses ~w(dreaming working done)

  def statuses, do: @statuses

  schema "milestones" do
    field :kind, :string
    field :title, :string
    field :description, :string
    field :when_label, :string
    field :status, :string
    field :position, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  def changeset(milestone, attrs) do
    milestone
    |> cast(attrs, [:kind, :title, :description, :when_label, :status, :position])
    |> update_change(:status, &blank_to_nil/1)
    |> validate_required([:kind, :title])
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:title, max: 160)
    |> validate_length(:when_label, max: 40)
    |> check_constraint(:kind, name: :known_kind)
    |> check_constraint(:status, name: :known_status)
  end

  defp blank_to_nil(""), do: nil
  defp blank_to_nil(value), do: value
end
