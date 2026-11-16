defmodule Portfolio.MediaTest do
  use Portfolio.DataCase, async: true

  alias Portfolio.Media

  # A real 1x1 PNG.
  @png Base.decode64!(
         "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
       )

  def upload(bytes, filename) do
    path = Path.join(System.tmp_dir!(), "upload-#{System.unique_integer([:positive])}")
    File.write!(path, bytes)
    on_exit(fn -> File.rm(path) end)
    %Plug.Upload{path: path, filename: filename, content_type: "application/octet-stream"}
  end

  test "stores a real image and detects its type from the bytes" do
    {:ok, image} = Media.create_from_upload(upload(@png, "me.jpg"), "Me")
    assert image.content_type == "image/png"
    assert image.byte_size == byte_size(@png)
    assert Media.get_image(image.id).data == @png
    assert [%{id: id, data: nil}] = Media.list_images()
    assert id == image.id
  end

  test "refuses files that aren't images, including SVG" do
    assert {:error, msg} = Media.create_from_upload(upload("<svg onload=alert(1)>", "x.svg"))
    assert msg =~ "Only JPEG"
    assert {:error, _} = Media.create_from_upload(upload("hello", "x.png"))
  end

  test "refuses files over 5 MB" do
    big = @png <> :binary.copy(<<0>>, 5 * 1024 * 1024)
    assert {:error, msg} = Media.create_from_upload(upload(big, "big.png"))
    assert msg =~ "over 5 MB"
  end

  test "database rejects a disallowed type even if the app is bypassed" do
    assert_raise Postgrex.Error, ~r/allowed_type/, fn ->
      now = DateTime.utc_now(:second)

      Repo.insert_all("images", [
        %{filename: "x", content_type: "image/svg+xml", byte_size: 1, data: "x", inserted_at: now, updated_at: now}
      ])
    end
  end

  test "detect_type covers the supported formats" do
    assert {:ok, "image/jpeg"} = Media.detect_type(<<0xFF, 0xD8, 0xFF, 0xE0>>)
    assert {:ok, "image/gif"} = Media.detect_type("GIF89a....")
    assert {:ok, "image/webp"} = Media.detect_type("RIFF" <> <<1, 2, 3, 4>> <> "WEBPVP8 ")
  end
end
