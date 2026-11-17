defmodule Portfolio.Media do
  @moduledoc """
  Uploaded images, stored in Postgres and served from /media/:id.

  The file type is detected from the file's first bytes, never from its
  name or the browser's claim, so only real JPEG/PNG/WebP/GIF images are
  accepted. SVG is refused because it can carry scripts.
  """

  import Ecto.Query
  alias Portfolio.Repo
  alias Portfolio.Media.Image

  @doc "All images, newest first, without loading their bytes."
  def list_images do
    Image
    |> select([i], struct(i, [:id, :filename, :content_type, :byte_size, :alt, :in_slideshow, :inserted_at]))
    |> order_by(desc: :id)
    |> Repo.all()
  end

  @doc """
  Image ids for the background photo loop: the profile photo first, then
  every image marked for the slideshow, oldest first.
  """
  def slideshow_ids(profile_photo_id) do
    marked =
      Image
      |> where(in_slideshow: true)
      |> order_by(asc: :id)
      |> select([i], i.id)
      |> Repo.all()

    Enum.uniq(Enum.reject([profile_photo_id | marked], &is_nil/1))
  end

  def set_slideshow(id, value) when is_boolean(value) do
    {count, _} =
      Image
      |> where(id: ^id)
      |> Repo.update_all(set: [in_slideshow: value, updated_at: DateTime.utc_now(:second)])

    if count == 1, do: :ok, else: {:error, :not_found}
  end

  def get_image(id), do: Repo.get(Image, id)

  def delete_image(id) do
    case Repo.get(Image, id) do
      nil -> {:error, :not_found}
      image -> Repo.delete(image)
    end
  end

  @doc "Public URL path of an image."
  def path(%Image{id: id}), do: "/media/#{id}"
  def path(id) when is_integer(id), do: "/media/#{id}"

  @doc """
  Stores an uploaded file. Returns `{:ok, image}` or `{:error, message}`
  with a message that can be shown to the user.
  """
  def create_from_upload(%Plug.Upload{path: path, filename: filename}, alt \\ nil) do
    max = Image.max_bytes()

    with {:ok, %{size: size}} <- File.stat(path),
         :ok <- if(size <= max, do: :ok, else: {:error, "That file is over 5 MB. Please use a smaller image."}),
         {:ok, data} <- File.read(path),
         {:ok, type} <- detect_type(data) do
      %Image{}
      |> Image.changeset(%{
        filename: Path.basename(filename || "image"),
        content_type: type,
        byte_size: byte_size(data),
        data: data,
        alt: blank_to_nil(alt)
      })
      |> Repo.insert()
      |> case do
        {:ok, image} -> {:ok, image}
        {:error, _changeset} -> {:error, "That image couldn't be saved."}
      end
    else
      {:error, message} when is_binary(message) -> {:error, message}
      {:error, _posix} -> {:error, "That upload couldn't be read. Please try again."}
    end
  end

  @doc "Detects the image type from the file's first bytes."
  def detect_type(<<0xFF, 0xD8, 0xFF, _::binary>>), do: {:ok, "image/jpeg"}
  def detect_type(<<0x89, "PNG", 0x0D, 0x0A, 0x1A, 0x0A, _::binary>>), do: {:ok, "image/png"}
  def detect_type(<<"GIF87a", _::binary>>), do: {:ok, "image/gif"}
  def detect_type(<<"GIF89a", _::binary>>), do: {:ok, "image/gif"}
  def detect_type(<<"RIFF", _::binary-size(4), "WEBP", _::binary>>), do: {:ok, "image/webp"}
  def detect_type(_), do: {:error, "Only JPEG, PNG, WebP or GIF images can be uploaded."}

  defp blank_to_nil(value) when value in [nil, ""], do: nil
  defp blank_to_nil(value), do: String.trim(value)
end
