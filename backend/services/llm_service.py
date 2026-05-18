def generate_chat_response(system_prompt, messages, context_entries=None):
    return "Mock creative response. Configure LLM_PROVIDER=openai or local after the core workflow is ready."


def generate_shot_breakdown(script_text, context_entries=None):
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


def generate_image_prompt(shot, frame_type, input_slots=None, context_entries=None):
    return f"Mock {frame_type} frame prompt for: {shot.get('description', 'current shot')}"


def generate_video_prompt(shot, first_frame=None, last_frame=None, context_entries=None):
    return f"Mock video prompt for: {shot.get('description', 'current shot')}"


def generate_lore_sheet(entries):
    titles = ", ".join(entry.get("title", "Untitled") for entry in entries)
    return f"Mock lore sheet covering: {titles}"

