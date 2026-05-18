import os

from openai import AsyncOpenAI


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.getenv("LOCAL_LLM_API_KEY", "local"),
        base_url=os.getenv("LOCAL_LLM_BASE_URL", "http://localhost:11434/v1"),
    )


async def chat(system_prompt: str, messages: list[dict]) -> str:
    client = get_client()
    response = await client.chat.completions.create(
        model=os.getenv("LOCAL_LLM_MODEL", "qwen2.5-coder:32b"),
        messages=[{"role": "system", "content": system_prompt}, *messages],
    )
    return response.choices[0].message.content or ""

