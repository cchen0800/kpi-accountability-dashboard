"""
Thin wrapper around OpenAI API with token counting and cost estimation.
"""

import json
import logging
from openai import OpenAI
from config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TIMEOUT_SECONDS

log = logging.getLogger(__name__)

# Pricing per 1M tokens (as of 2025)
MODEL_PRICING = {
    'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
    'gpt-4o': {'input': 2.50, 'output': 10.00},
    'gpt-4.1-mini': {'input': 0.40, 'output': 1.60},
    'gpt-4.1-nano': {'input': 0.10, 'output': 0.40},
}

client = OpenAI(api_key=OPENAI_API_KEY)


def call_gpt(system_prompt, user_prompt, temperature=0.7):
    """Call GPT and return parsed JSON response + usage stats."""
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=temperature,
        timeout=OPENAI_TIMEOUT_SECONDS,
    )

    message = response.choices[0].message.content
    usage = response.usage

    try:
        parsed = json.loads(message)
    except json.JSONDecodeError:
        log.error("Failed to parse GPT response as JSON: %s", message[:200])
        raise

    return {
        'data': parsed,
        'prompt_tokens': usage.prompt_tokens,
        'completion_tokens': usage.completion_tokens,
        'total_tokens': usage.total_tokens,
    }


def estimate_cost_cents(model, prompt_tokens, completion_tokens):
    """Estimate cost in cents based on model pricing."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING['gpt-4o-mini'])
    input_cost = (prompt_tokens / 1_000_000) * pricing['input'] * 100
    output_cost = (completion_tokens / 1_000_000) * pricing['output'] * 100
    return round(input_cost + output_cost, 4)
