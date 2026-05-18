import json
import os
import re

from services import local_llm_service, openai_service

SHOT_BREAKDOWN_SYSTEM_PROMPT = """You are a shot breakdown assistant for an animated short-form series.
Given a script, break it into individual shots. Each shot should be a single continuous camera moment.
Return valid JSON only:
{
  "shots": [
    {
      "order_index": 1,
      "description": "...",
      "characters": ["Character1", "Character2"],
      "setting": "...",
      "mood": "...",
      "has_dialogue": true,
      "music_notes": "..."
    }
  ]
}
"""

IMAGE_PROMPT_SYSTEM_PROMPT = """You are a prompt engineer for an animated series with absurdist comedy.
Given a shot description, the current image input slots (listed by index and user label),
and any relevant lore, generate an image generation prompt for the model.

The model accepts an ordered array of reference images. Your prompt should reference
them by slot number as they appear in the input: "the character from image 1",
"use the setting from image 2", "place the character from image 3 into the scene", etc.

Scaffold the prompt around what the user is trying to achieve with this specific
combination of inputs. Be specific about character positions, expressions, lighting,
framing, camera angle, and setting details.

Return only the prompt text, no explanation.
"""

VIDEO_PROMPT_SYSTEM_PROMPT = """You are a video prompt engineer for animated short-form content.
Given a shot description and approved frame context, generate an image-to-video prompt.
Focus on motion, camera movement, character animation, timing, and atmosphere.
Return only the prompt text, no explanation.
"""


def mock_shot_breakdown():
    return {
        "shots": [
            {
                "order_index": 1,
                "description": "Establish the Buddy Day setting and the main character entering with too much confidence.",
                "characters": ["Buddy"],
                "setting": "Buddy Field",
                "mood": "bright, awkward, expectant",
                "has_dialogue": False,
                "music_notes": "Playful opener.",
            },
            {
                "order_index": 2,
                "description": "A simple task escalates into a visual misunderstanding.",
                "characters": ["Buddy", "Friend"],
                "setting": "Same location",
                "mood": "confused, comic",
                "has_dialogue": True,
                "music_notes": "Light tension sting.",
            },
            {
                "order_index": 3,
                "description": "The characters freeze on the final absurd consequence.",
                "characters": ["Buddy", "Friend"],
                "setting": "Same location",
                "mood": "deadpan punchline",
                "has_dialogue": False,
                "music_notes": "Short button.",
            },
        ]
    }


def provider_name() -> str:
    return os.getenv("LLM_PROVIDER", "mock").lower()


async def provider_chat(system_prompt: str, messages: list[dict]) -> str:
    provider = provider_name()
    if provider == "openai":
        return await openai_service.chat(system_prompt, messages)
    if provider == "local":
        return await local_llm_service.chat(system_prompt, messages)
    return "Mock creative response. Set LLM_PROVIDER=openai or local to use a real assistant."


def context_text(context_entries=None) -> str:
    if not context_entries:
        return ""
    chunks = []
    for entry in context_entries:
        title = entry.get("title", "Untitled") if isinstance(entry, dict) else getattr(entry, "title", "Untitled")
        content = entry.get("content", "") if isinstance(entry, dict) else getattr(entry, "content", "")
        chunks.append(f"{title}: {content}")
    return "\n\n".join(chunks)


def parse_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


async def generate_chat_response(system_prompt, messages, context_entries=None):
    context = context_text(context_entries)
    full_system = f"{system_prompt}\n\nContext:\n{context}" if context else system_prompt
    return await provider_chat(full_system, messages)


async def generate_shot_breakdown(script_text, context_entries=None):
    if provider_name() == "mock":
        return mock_shot_breakdown()
    context = context_text(context_entries)
    user_text = f"Context:\n{context}\n\nScript:\n{script_text}" if context else f"Script:\n{script_text}"
    response = await provider_chat(SHOT_BREAKDOWN_SYSTEM_PROMPT, [{"role": "user", "content": user_text}])
    parsed = parse_json_object(response)
    if "shots" not in parsed or not isinstance(parsed["shots"], list):
        raise ValueError("LLM response did not include a shots array")
    return parsed


async def generate_image_prompt(shot, frame_type, input_slots=None, context_entries=None):
    if provider_name() == "mock":
        return f"Mock {frame_type} frame prompt for: {shot.get('description', 'current shot')}"
    slots_text = "\n".join(
        f"Image {slot.get('slot_index', index + 1)}: {slot.get('label') or slot.get('source_type') or 'reference'}"
        for index, slot in enumerate(input_slots or [])
    )
    context = context_text(context_entries)
    user_text = f"Frame type: {frame_type}\nShot: {json.dumps(shot)}\nInput slots:\n{slots_text}\n\nContext:\n{context}"
    return await provider_chat(IMAGE_PROMPT_SYSTEM_PROMPT, [{"role": "user", "content": user_text}])


async def generate_video_prompt(shot, first_frame=None, last_frame=None, context_entries=None):
    if provider_name() == "mock":
        return f"Mock video prompt for: {shot.get('description', 'current shot')}"
    context = context_text(context_entries)
    user_text = f"Shot: {json.dumps(shot)}\nFirst frame: {first_frame or 'approved'}\nLast frame: {last_frame or 'approved'}\nContext:\n{context}"
    return await provider_chat(VIDEO_PROMPT_SYSTEM_PROMPT, [{"role": "user", "content": user_text}])


async def generate_lore_sheet(entries):
    if provider_name() == "mock":
        titles = ", ".join(entry.get("title", "Untitled") for entry in entries)
        return f"Mock lore sheet covering: {titles}"
    return await provider_chat(
        "You generate concise production lore sheets from source notes. Return clean markdown.",
        [{"role": "user", "content": json.dumps(entries)}],
    )
