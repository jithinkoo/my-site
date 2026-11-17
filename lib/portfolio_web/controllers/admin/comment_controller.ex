defmodule PortfolioWeb.Admin.CommentController do
  use PortfolioWeb, :controller

  alias Portfolio.Blog

  def delete(conn, %{"id" => id}) do
    message =
      case Blog.delete_comment(id) do
        {:ok, _} -> {:info, "Comment deleted."}
        {:error, :not_found} -> {:error, "That comment was already gone."}
      end

    {kind, text} = message

    conn
    |> put_flash(kind, text)
    |> redirect(to: back_to(conn))
  end

  # Return to the post the admin was reading, if the browser says where.
  defp back_to(conn) do
    with [referer | _] <- get_req_header(conn, "referer"),
         %URI{path: path} when is_binary(path) <- URI.parse(referer),
         true <- String.starts_with?(path, ["/thoughts/", "/stories/", "/places/"]) do
      path <> "#comments"
    else
      _ -> ~p"/admin"
    end
  end
end
