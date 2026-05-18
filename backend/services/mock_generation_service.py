from pathlib import Path

MOCK_ASSET_DIR = Path("../mock-assets")


def generate_image(*_, **__) -> dict:
    return {
        "provider": "mock",
        "prediction_id": "mock-image",
        "file_path": str(MOCK_ASSET_DIR / "sample-first.png"),
    }


def generate_video(*_, **__) -> dict:
    return {
        "provider": "mock",
        "prediction_id": "mock-video",
        "file_path": str(MOCK_ASSET_DIR / "sample-video.mp4"),
    }

