import mimetypes
import os
import shutil
from pathlib import Path
from urllib.request import urlopen

import replicate

IMAGE_MODEL = "google/nano-banana-pro"
VIDEO_MODEL = "prunaai/p-video"


def get_client() -> replicate.Client:
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN is not configured")
    return replicate.Client(api_token=token)


def upload_reference_file(path: Path) -> str:
    client = get_client()
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    uploaded = client.files.create(path, content_type=content_type)
    return uploaded.urls["get"]


def normalize_output(output):
    if isinstance(output, list):
        return output[0] if output else ""
    return output


def output_to_url(output) -> str:
    output = normalize_output(output)
    if not output:
        return ""
    if hasattr(output, "url"):
        return str(output.url)
    return str(output)


def generate_image(prompt, image_input_urls, resolution, aspect_ratio):
    input_payload = {
        "prompt": prompt,
        "image_input": image_input_urls,
        "output_format": "png",
        "resolution": resolution,
    }
    output = get_client().run(IMAGE_MODEL, input=input_payload)
    return output_to_url(output)


def generate_video(prompt, image_url, audio_url, duration, resolution, fps, draft, seed):
    input_payload = {
        "prompt": prompt,
        "image": image_url,
        "resolution": resolution,
        "fps": fps,
        "draft": draft,
        "prompt_upsampling": True,
    }
    if seed is not None:
        input_payload["seed"] = seed
    if audio_url:
        input_payload["audio"] = audio_url
    else:
        input_payload["duration"] = duration

    output = get_client().run(VIDEO_MODEL, input=input_payload)
    return output_to_url(output)


def download_output_to_path(url, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)
    return str(destination)


def poll_prediction(prediction_id):
    return get_client().predictions.get(prediction_id)


def download_output_to_episode_folder(url, episode_title, filename):
    root = Path(os.getenv("OUTPUTS_DIR", "../outputs")).resolve()
    episode_slug = "".join(char.lower() if char.isalnum() else "_" for char in episode_title).strip("_")
    destination = root / episode_slug / filename
    return download_output_to_path(url, destination)
