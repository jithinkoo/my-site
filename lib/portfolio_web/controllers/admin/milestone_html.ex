defmodule PortfolioWeb.Admin.MilestoneHTML do
  use PortfolioWeb, :html

  embed_templates "milestone_html/*"

  attr :form, Phoenix.HTML.Form, required: true
  attr :action, :string, required: true
  attr :method, :string, default: "post"
  attr :kind, :string, required: true

  def milestone_form(assigns) do
    ~H"""
    <.form for={@form} action={@action} method={@method} class="editor">
      <input type="hidden" name="milestone[kind]" value={@kind} />
      <.input
        field={@form[:title]}
        label={if @kind == "goal", do: "Goal", else: "Achievement"}
        placeholder={if @kind == "goal", do: "e.g. Run a half marathon", else: "e.g. Led the move to Elixir at work"}
        maxlength="160"
        required
        autofocus
      />
      <.input
        field={@form[:when_label]}
        label={if @kind == "goal", do: "When (optional)", else: "When"}
        placeholder={if @kind == "goal", do: "e.g. By 2027, or Someday", else: "e.g. 2023, or March 2024"}
        maxlength="40"
      />
      <div :if={@kind == "goal"} class="field">
        <label for="milestone_status">Status</label>
        <select id="milestone_status" name="milestone[status]" class="select">
          <option value="" selected={@form[:status].value in [nil, ""]}>(none)</option>
          <option
            :for={{value, label} <- [{"dreaming", "Dreaming"}, {"working", "Working on it"}, {"done", "Done"}]}
            value={value}
            selected={@form[:status].value == value}
          >
            {label}
          </option>
        </select>
      </div>
      <.input
        field={@form[:description]}
        type="textarea"
        rows="5"
        label="A few words about it (optional)"
        hint="Markdown works. Keep it short; write a full story as a post instead."
      />
      <.input
        field={@form[:position]}
        type="number"
        label="Order (optional)"
        hint="Lower numbers show first. Leave 0 to show newest first."
      />
      <div class="actions">
        <button type="submit" class="button">Save</button>
        <a href={~p"/admin/milestones"} class="button button-quiet">Cancel</a>
      </div>
    </.form>
    """
  end
end
