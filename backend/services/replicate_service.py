IMAGE_MODEL = "google/nano-banana-pro"
VIDEO_MODEL = "prunaai/p-video"


def generate_image(prompt, image_input_urls, resolution, aspect_ratio):
    raise NotImplementedError("Replicate image generation is planned after mock workflow completion.")


def generate_video(prompt, image_url, audio_url, duration, resolution, fps, draft, seed):
    raise NotImplementedError("Replicate video generation is planned after mock workflow completion.")


def poll_prediction(prediction_id):
    raise NotImplementedError("Replicate polling is planned after mock workflow completion.")


def download_output_to_episode_folder(url, episode_title, filename):
    raise NotImplementedError("Replicate downloads are planned after mock workflow completion.")

