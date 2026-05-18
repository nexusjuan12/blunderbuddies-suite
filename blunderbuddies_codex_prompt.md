# Blunderbuddies Production Suite — Claude Code Build Prompt

I need you to build a local web application called "Blunderbuddies Production Suite" — a creative production companion for an animated YouTube series.

This is a personal tool that will also be published as a public GitHub repo, so code quality, clear architecture, and documentation matter.

---

## IMPORTANT BUILD APPROACH

Build this in working phases. Do not try to implement every API integration first. Start with the data model, backend routes, frontend navigation, and the shot-by-shot workflow using mock generation outputs. Then wire in real API providers after the core workflow works.

The app should be designed around a provider-neutral LLM layer. OpenAI is the default provider. The architecture must support OpenAI, local OpenAI-compatible endpoints, and mock mode without requiring code changes — only environment variable changes.

Core design philosophy:
- This is NOT a full automation pipeline
- This is a structured creative workspace
- The human stays in the loop at every creative decision
- The app handles file management, prompt storage, API calls, state tracking, and shot progression so the creator can focus on creative choices

The workflow is:
script → editable shot plan → one-shot-at-a-time production → first frame → last frame → video → audio → assembly checklist

Future shots must remain editable until generation begins for that specific shot. Do not globally freeze the entire shot list once production starts.

---

## Tech Stack

- Frontend: React with Vite, plain JavaScript, no TypeScript
- Backend: Python FastAPI
- Database: SQLite via SQLAlchemy async
- Styling: Plain CSS, dark-mode friendly
- Target OS: Ubuntu 22.04 primary, OS-agnostic goal
- Launch: single `./start.sh` starts backend and frontend

---

## Project Structure

```
blunderbuddies-suite/
├── README.md
├── .env.example
├── start.sh
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── schemas.py
│   ├── services/
│   │   ├── llm_service.py
│   │   ├── openai_service.py
│   │   ├── local_llm_service.py
│   │   ├── replicate_service.py
│   │   ├── mock_generation_service.py
│   │   └── audio_service.py
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── pages/
│       │   ├── Library.jsx
│       │   ├── ScriptStudio.jsx
│       │   ├── ShotBreakdown.jsx
│       │   ├── ShotWorkshop.jsx
│       │   ├── Audio.jsx
│       │   └── Assembly.jsx
│       ├── components/
│       │   ├── ShotCanvas.jsx
│       │   ├── ShotCard.jsx
│       │   ├── PromptEditor.jsx
│       │   ├── AssistantPanel.jsx
│       │   ├── ImageInputSlots.jsx
│       │   └── AssetGallery.jsx
│       └── styles.css
├── mock-assets/
│   ├── mock-ref-a.png
│   ├── mock-ref-b.png
│   ├── mock-ref-c.png
│   ├── sample-first.png
│   ├── sample-last.png
│   └── sample-video.mp4
└── outputs/
    └── {episode_title}/
        ├── images/
        ├── videos/
        ├── audio/
        └── music/
```

---

## Environment Variables

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1

LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=qwen2.5-coder:32b

LLM_PROVIDER=openai
# valid values: openai, local, mock

REPLICATE_API_TOKEN=
GENERATION_MODE=mock
# valid values: mock, replicate

DATABASE_URL=sqlite+aiosqlite:///./blunderbuddies.db
OUTPUTS_DIR=./outputs
```

---

## Database Models

```
Episode:
  id
  title
  type: short|long|special
  buddy_day_name
  script_text
  status: draft|script_locked|planning|in_production|complete
  created_at
  updated_at

Shot:
  id
  episode_id
  order_index
  description
  characters: JSON array
  setting
  mood
  has_dialogue: bool
  music_notes
  status: planned|active|frames_in_progress|frames_approved|video_in_progress|approved|skipped|replaced
  generation_started: bool
  locked: bool
  created_at
  updated_at

Image:
  id
  shot_id
  frame_type: first|last
  prompt
  resolution
  aspect_ratio
  provider
  prediction_id
  file_path
  approved: bool
  created_at

ImageInputSlot:
  id
  image_id
  slot_index
  label
  source_type: library|upload|previous_generation
  library_entry_id (nullable FK to LoreEntry)
  file_path
  url

Video:
  id
  shot_id
  prompt
  model: p-video|ltx2|manual
  duration_seconds
  fps
  draft_mode: bool
  seed
  provider
  prediction_id
  file_path
  approved: bool
  created_at

AudioLine:
  id
  shot_id
  character_name
  line_text
  file_path
  silence_start_ms
  silence_end_ms
  padded_file_path
  total_duration_ms

MusicTrack:
  id
  episode_id
  scene_reference
  track_type: music|sfx|ambient
  file_path
  notes

LoreEntry:
  id
  entry_type: character|setting|lore|script|reference
  title
  content
  tags: JSON array
  asset_path (nullable — for image reference entries)
  created_at
  updated_at

PromptHistory:
  id
  shot_id
  target_type: image_first|image_last|video|shot_plan|script|lore
  prompt
  provider
  model
  created_at
```

---

## Module 0: Reference Library

A searchable library that is the foundation for everything else.

Entry types:
- Characters: name, description, voice notes, visual description, relationships
- Settings: name, description, visual reference notes
- Lore: general world-building entries
- Scripts: past episode scripts (stored automatically when locked in Module 1)
- Reference: saved image assets (character sheets, setting images, etc.) — these are the images available for selection in the Shot Workshop image input slots

Features:
- Create/edit/delete entries
- Tag entries
- Full-text search across all entries
- Select entries to inject as assistant context
- Generate lore sheet using configured LLM provider
- Reference-type entries support image upload and display a thumbnail
- Locked scripts auto-appear as Script entries

Do not use the label "Claude Assist." Use labels like:
- Creative Assistant
- Writer Assist
- Planning Assistant
- Prompt Assistant

---

## Module 1: Script Studio

Layout: two-panel. Left = metadata + script editor. Right = optional Creative Assistant.

Left panel:
- Episode title input
- Episode type selector (Short / Long / Special)
- Buddy Day name input
- Large script textarea
- Lock Script button

Lock Script:
- Sets episode status to script_locked
- Saves script to Reference Library as a Script entry
- Enables Shot Breakdown

Right panel (Creative Assistant):
- System prompt area, editable, pre-filled with useful default
- Chat interface powered by configured LLM provider
- User selects which Library entries to inject as context
- For brainstorming only — final script is always manually controlled

---

## Module 2: Shot Breakdown

Accessible after script is locked.

Flow:
1. Generate shot list button — sends script to LLM provider
2. Returns valid JSON shot list
3. Renders as editable shot cards
4. Every field is editable inline
5. User can: delete, split, duplicate, add below, drag to reorder
6. Assistant panel can suggest changes — user must approve/apply
7. Begin Production button (not "Lock Shot List")

Begin Production:
- Creates Shot records in DB
- Sets episode status to in_production
- All shots start as planned
- Future shots remain editable until generation_started becomes true for that shot

---

## Module 3: Shot Workshop

This is the core module. The user works one shot at a time:

Shot 1 first frame → approve → last frame → approve → video → approve → next shot

### Top Area: Shot Canvas (sticky)

Horizontal scrollable strip showing all shots in order:
- Approved shots: thumbnail pair (first + last frame), shot number, short description
- Current shot: highlighted with colored border, IN PROGRESS badge
- Future shots (generation_started = false): gray card, description text, fully editable on click
- Clicking an approved shot opens revisit mode

### Main Area: Current Shot Workspace

Display: shot number, description, characters, setting, mood, dialogue flag, music notes

---

### Step A — First Frame

**Prompt area:**
- Prompt textarea
- Prompt Assistant button — generates a suggested prompt from shot description and selected lore entries
- The assistant should scaffold the prompt referencing image slots by number:
  example: "Place the character from image 2 into the setting from image 1. She has just stepped into frame holding a fire extinguisher..."
- Prompt history dropdown — every submitted prompt is stored and selectable

**Image input slots:**

This is the core of how image generation works for this app. The model (nano-banana-pro) accepts an ordered array of reference images alongside the text prompt. The prompt addresses these images by their position: "the character from image 1", "the setting from image 2", "use image 3 as the background", etc. The relationship between images is defined entirely by the prompt text — not by typed slot roles.

The image input slot UI must reflect this fluidity:

- Slots are a dynamic ordered list. The user can add as many slots as needed (up to 14, the model limit).
- Each slot displays:
  - Its index number (1, 2, 3...) — this is what the prompt references
  - A thumbnail of the selected image
  - A freetext label field the user fills in for their own reference (e.g. "Nuh-uh ref", "Buddy Field background", "first frame output"). This label is for the user only and is not sent to the model.
  - A remove button
- Slots are draggable to reorder. Reordering updates the index numbers displayed and the user must update their prompt accordingly. Show a warning banner when slots are reordered: "Slot order changed — check your prompt references."
- Each slot has three ways to populate it:
  1. Pick from Library — opens a filtered asset picker showing all Reference-type LoreEntries with thumbnails
  2. Upload fresh — upload any image file directly
  3. Use previous generation — a quick-add button that inserts the most recently approved image for this shot (first frame output, for instance) as a new slot. This is a very common pattern: generate frame 1, then use that output as an input slot for the next generation to iterate on it.
- The ordered list of slot image URLs/paths is passed as image_input to the generation API.
- In mock mode: slots are shown and functional for UX testing but the mock generation ignores them and returns a mock image.

**Generation controls:**
- Resolution picker: 1K / 2K / 4K
- Aspect ratio picker: 16:9 / 9:16 / 1:1 / 4:3
- Generate button
- In mock mode: simulate async polling with a fake delay, return mock image from mock-assets/
- In replicate mode: call google/nano-banana-pro, poll prediction, display result

**Result gallery:**
- Displays all generated images for this shot/frame type
- Click to select
- Approve selected image button
- Regenerate button

---

### Step B — Last Frame

- Locked until first frame is approved
- Same UI as Step A including full image input slot system
- Prompt pre-seeded from first-frame prompt as a starting point
- "Use previous generation" quick-add defaults to the approved first frame

---

### Step C — Video

Locked until first and last frames are both approved.

- Prompt textarea with Prompt Assistant and history dropdown
- Model picker:
  - p-video (Replicate)
  - LTX 2 / Wan2GP (manual)
  - Manual upload

**If p-video selected:**
- Duration slider (1–10 seconds) — disabled and replaced with audio duration note if audio is provided
- FPS: 24 / 48
- Resolution: 720p / 1080p
- Draft mode toggle (default ON):
  - Draft mode fires with draft: true for fast low-res preview
  - After draft approved: "Upgrade to Final" button reruns with draft: false and same seed
  - Store the seed returned from the prediction — reuse it for the upgrade
- Optional audio input:
  - Upload an audio file (already processed/padded before upload)
  - If audio provided: duration field disabled, note says "Video duration will match audio length"
  - If no audio provided: video model generates its own audio. This is intentional and often preferred for non-dialogue shots. Do not prompt the user to add audio — absence of audio is a valid creative choice.
- Generate → poll → display in HTML5 player → approve

**If LTX 2 / Wan2GP selected:**
- Show copyable prompt box
- Note: "Copy this prompt into Wan2GP, then upload the result below."
- File upload for the result video

**If manual upload:**
- File upload only

**Approve shot:**
- Sets shot status to approved
- Locks that individual shot
- Updates canvas thumbnail
- Auto-advances to next planned shot

**Revisit mode:**
- User can reopen any approved shot
- Existing approved assets are not deleted
- New generations are added as alternatives in the gallery
- User can approve a replacement

---

## Module 4: Audio

Accessible any time after production begins, runs parallel to Shot Workshop.

Shows all shots where has_dialogue is true, grouped by character.

Per AudioLine:
- Character name (read-only)
- Line text from script (read-only reference)
- Upload audio file (pre-processed — RVC or any other post-processing is done before upload)
- Audio preview player
- Silence padding controls:
  - Silence at start (ms) — number input
  - Silence at end (ms) — number input
  - Apply Padding button
  - Backend uses pydub:
    - Load uploaded audio
    - Prepend silence_start_ms of silence
    - Append silence_end_ms of silence
    - Export padded wav to outputs/{episode}/audio/{shot_num}_{character}_padded.wav
    - Calculate and store total_duration_ms
  - Display after padding: "Total: 4.2s — use this as video duration for this shot"
- Status badge: missing / uploaded / padded

Backing tracks section (per episode):
- Optional upload slot per scene/shot for backing track
- Track type: music / sfx / ambient
- Notes field
- If no track: display "No backing track — video model audio or silence will be used."

---

## Module 5: Assembly Checklist

Shot completion table — one row per shot:
- Shot number and description
- First frame: approved / pending / missing
- Last frame: approved / pending / missing
- Video: approved / draft / pending / missing
- Audio: padded / uploaded / missing
- Music: attached / none

Export Output Folder button — organizes all approved assets:

```
outputs/{episode_title}/
  images/
    shot_01_first.png
    shot_01_last.png
    shot_02_first.png
    ...
  videos/
    shot_01.mp4
    shot_02.mp4
    ...
  audio/
    shot_01_nuh-uh_padded.wav
    ...
  music/
    scene_01_backing.mp3
    ...
  shot_sheet.txt
```

shot_sheet.txt format:
```
EPISODE: [title]
BUDDY DAY: [buddy day name]
TYPE: [short/long/special]
TOTAL SHOTS: N

SHOT 01 — [description]
  Characters: ...
  Setting: ...
  Mood: ...
  Video: shot_01.mp4 (4.2s, final)
  Audio: shot_01_nuh-uh_padded.wav (4.2s)
  Music: none
  Notes: ...

SHOT 02 — ...
```

---

## LLM Provider Layer

Create a provider-neutral service at services/llm_service.py

Expose these functions:

```python
generate_chat_response(system_prompt, messages, context_entries=None)
generate_shot_breakdown(script_text, context_entries=None)
generate_image_prompt(shot, frame_type, input_slots=None, context_entries=None)
generate_video_prompt(shot, first_frame=None, last_frame=None, context_entries=None)
generate_lore_sheet(entries)
```

Note: generate_image_prompt receives the current input_slots list (index, label, source) so the assistant can reference them by number in the scaffolded prompt output.

Implement three providers:

**OpenAI provider (openai_service.py):**
Use the OpenAI Python SDK with OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL.

**Local provider (local_llm_service.py):**
Use OpenAI-compatible API format against LOCAL_LLM_BASE_URL.
Must work with Ollama, LM Studio, vLLM, text-generation-webui, or any server exposing an OpenAI-compatible endpoint.

**Mock provider:**
Return deterministic placeholder text and valid JSON structures for development.
Mock shot breakdown should return 3–5 plausible placeholder shots.
Mock image/video prompts should return a short placeholder string.

Do not hardcode any single LLM provider into the main application.

---

## LLM Prompts to Implement

**Shot breakdown system prompt:**
```
You are a shot breakdown assistant for an animated short-form series.
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
```

**Image prompt system prompt:**
```
You are a prompt engineer for an animated series with absurdist comedy.
Given a shot description, the current image input slots (listed by index and user label),
and any relevant lore, generate an image generation prompt for the model.

The model accepts an ordered array of reference images. Your prompt should reference
them by slot number as they appear in the input: "the character from image 1",
"use the setting from image 2", "place the character from image 3 into the scene", etc.

Scaffold the prompt around what the user is trying to achieve with this specific
combination of inputs. Be specific about character positions, expressions, lighting,
framing, camera angle, and setting details.

Return only the prompt text, no explanation.
```

**Video prompt system prompt:**
```
You are a video prompt engineer for animated short-form content.
Given a shot description and approved frame context, generate an image-to-video prompt.
Focus on motion, camera movement, character animation, timing, and atmosphere.
Return only the prompt text, no explanation.
```

**Interactive planning prompt:**
```
You are a production planning assistant.
The user is editing a shot list for an animated short.
Suggest practical edits to the shot list, but do not assume changes are final.
Return either plain English suggestions, or structured JSON patch suggestions
if the user explicitly asks for direct edits.
```

---

## Replicate Provider

Implement after mock mode is fully functional.

replicate_service.py:
- generate_image(prompt, image_input_urls, resolution, aspect_ratio)
- generate_video(prompt, image_url, audio_url, duration, resolution, fps, draft, seed)
- poll_prediction(prediction_id)
- download_output_to_episode_folder(url, episode_title, filename)

Image model: google/nano-banana-pro

```python
output = replicate.run(
    "google/nano-banana-pro",
    input={
        "prompt": prompt,
        "image_input": image_input_urls,  # ordered list from slots, can be empty
        "output_format": "png",
        "resolution": resolution  # "1K", "2K", "4K"
    }
)
```

Video model: prunaai/p-video

```python
input_payload = {
    "prompt": prompt,
    "image": first_frame_url,
    "duration": duration_seconds,  # omit if audio provided
    "resolution": resolution,      # "720p" or "1080p"
    "fps": fps,
    "draft": draft_mode,
    "seed": seed,
    "prompt_upsampling": True
}
if audio_url:
    input_payload["audio"] = audio_url
    del input_payload["duration"]  # duration ignored when audio provided

output = replicate.run("prunaai/p-video", input=input_payload)
```

When audio is provided to p-video, duration is ignored — the video length automatically matches the audio. This is the mechanism for lipsync shots: pad the audio to the exact desired length, upload it, and the video matches automatically.

Draft mode workflow:
- Fire with draft: true and store the returned seed
- User previews result
- "Upgrade to Final" reruns with draft: false and the same seed
- Draft and final will match in motion and composition

Keep all model identifiers in a config section at the top of replicate_service.py so they can be swapped without touching logic.

---

## Audio Service

services/audio_service.py using pydub:

```python
from pydub import AudioSegment

def pad_audio(input_path, output_path, silence_start_ms, silence_end_ms):
    audio = AudioSegment.from_file(input_path)
    silence_start = AudioSegment.silent(duration=silence_start_ms)
    silence_end = AudioSegment.silent(duration=silence_end_ms)
    padded = silence_start + audio + silence_end
    padded.export(output_path, format="wav")
    return len(padded)  # total duration in ms
```

---

## Frontend Requirements

- Clean dark interface
- Top navigation: Library | Script Studio | Shot Breakdown | Shot Workshop | Audio | Assembly
- Episode switcher always visible in top nav
- Autosave fields on blur (no explicit save button for most fields)
- Clear status badges on shots and episodes
- No overbuilt design system — plain CSS only
- ImageInputSlots.jsx is a standalone reusable component used in both Step A and Step B of the Shot Workshop

---

## start.sh

```bash
#!/bin/bash
set -e

echo "Starting Blunderbuddies Production Suite..."

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
```

---

## README.md

Include:
- What this app is and who it is for
- Setup instructions (clone repo, copy .env.example to .env, fill in keys, run ./start.sh)
- OpenAI setup
- Local LLM setup (Ollama, LM Studio, vLLM — any OpenAI-compatible endpoint)
- Mock mode explanation (GENERATION_MODE=mock, LLM_PROVIDER=mock)
- Replicate mode explanation
- Wan2GP / LTX 2 manual workflow explanation
- Image input slot system explanation (how prompt-addressable reference images work)
- Development phases
- License: MIT

---

## Build Phases

**Phase 1:** Project scaffold, backend database/models/routes, frontend nav/pages, episode CRUD, library CRUD

**Phase 2:** Script Studio, lock script, save to Library

**Phase 3:** Shot Breakdown, LLM mock provider, editable shot list, Begin Production

**Phase 4:** Shot Workshop with mock generation, Shot Canvas, image input slot system, first frame / last frame / video approval flow, prompt history

**Phase 5:** Audio upload and padding, Assembly checklist, export shot sheet

**Phase 6:** OpenAI provider, local LLM provider, assistant panels

**Phase 7:** Replicate image/video integration, polling, output download

**Phase 8:** Polish, README, error handling, GitHub cleanup

---

Start by creating the project scaffold and implementing Phase 1. Do not skip ahead to Replicate or LLM integrations until mock mode and the shot workflow are fully functional.
