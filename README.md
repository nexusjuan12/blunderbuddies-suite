# Blunderbuddies Production Suite

Blunderbuddies Production Suite is a local creative production workspace for an animated YouTube series. It is designed for a human-led workflow: script, editable shot plan, one-shot-at-a-time production, frame generation, video, audio, and final assembly tracking.

## Status

This repo is being built in phases. Phase 1 is the current baseline:

- FastAPI backend with async SQLite setup
- Episode CRUD
- Reference Library CRUD with basic search/filtering
- React/Vite frontend shell
- Top navigation and always-visible episode switcher
- Script Studio shell with autosave-on-blur fields and script locking

## Setup

```bash
cp .env.example .env
./start.sh
```

Frontend: http://localhost:5173  
Backend: http://localhost:8000

## Configuration

The app is provider-neutral by design. Mock mode is the default while the core workflow is being built.

```env
LLM_PROVIDER=mock
GENERATION_MODE=mock
```

For OpenAI later:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_PROVIDER=openai
```

For local OpenAI-compatible servers such as Ollama, LM Studio, vLLM, or text-generation-webui:

```env
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=qwen2.5-coder:32b
LLM_PROVIDER=local
```

Replicate image/video generation and Wan2GP/LTX manual workflows are planned after the mock shot workflow is complete.

## Image Input Slots

The planned generation workflow uses ordered image input slots. Prompts refer to these slots by number, such as "the character from image 1" or "use image 2 as the background." Slot labels are for the creator only and are not sent as typed roles to the model.

## Development Phases

1. Project scaffold, backend database/models/routes, frontend nav/pages, episode CRUD, library CRUD
2. Script Studio, lock script, save to Library
3. Shot Breakdown, LLM mock provider, editable shot list, Begin Production
4. Shot Workshop with mock generation, Shot Canvas, image input slot system, first frame / last frame / video approval flow, prompt history
5. Audio upload and padding, Assembly checklist, export shot sheet
6. OpenAI provider, local LLM provider, assistant panels
7. Replicate image/video integration, polling, output download
8. Polish, error handling, GitHub cleanup

## License

MIT

