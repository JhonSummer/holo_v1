"""DA contracts: no network, no model loading, no credentials."""
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.pod import Pod
from app.lessons.declarative_attention.schema import MemoryScene
from app.lessons.declarative_attention.tutor import PRESENT_TOOL, respond, validate_result

PODS = Path(__file__).resolve().parents[1] / "app" / "pods"


@pytest.fixture
def data():
    return json.loads((PODS / "declarative-attention.json").read_text())


def test_da_lesson_loads(data):
    pod = Pod.model_validate(data)
    assert isinstance(pod.scene, MemoryScene)
    assert len(pod.narration) == 11
    assert [c.id for c in pod.scene.params.chunks] == [1, 2, 3, 4]


@pytest.mark.parametrize("name", ["gpt2", "transformers-tech-behind-llms"])
def test_existing_lessons_still_load(name):
    pod = Pod.model_validate_json((PODS / f"{name}.json").read_text())
    assert pod.scene.type == "transformer"
    assert pod.scene.params.n_layers == 12


def test_unknown_chunk_is_rejected(data):
    data["narration"][6]["commands"][0]["args"]["chunks"] = [99]
    with pytest.raises(ValidationError):
        Pod.model_validate(data)


def test_duplicate_chunk_is_rejected(data):
    data["scene"]["params"]["chunks"][1]["id"] = 1
    with pytest.raises(ValidationError):
        Pod.model_validate(data)


def test_transformer_command_cannot_enter_da(data):
    data["narration"][0]["commands"] = [{"op": "runInference", "args": {"text": "hello"}}]
    with pytest.raises(ValidationError):
        Pod.model_validate(data)


def test_tutor_accepts_valid_focus(data):
    result = validate_result({"narration": "Only C3 is selected.", "commands": [
        {"op": "daMode", "args": {"mode": "focus", "chunks": [3]}}
    ]}, Pod.model_validate(data))
    assert result["commands"][0]["args"]["chunks"] == [3]


@pytest.mark.parametrize("command", [
    {"op": "runInference", "args": {}},
    {"op": "daMode", "args": {"mode": "focus", "chunks": [99]}},
    {"op": "daMode", "args": {"mode": "focus", "chunks": []}},
    {"op": "daMode", "args": {"mode": "evict", "chunks": [3]}},
    {"op": "daStage", "args": {"stage": "delete", "path": "/"}},
])
def test_tutor_rejects_invalid_commands(data, command):
    with pytest.raises((ValidationError, ValueError)):
        validate_result({"narration": "test", "commands": [command]}, Pod.model_validate(data))


def test_tool_schema_is_inline_and_bridge_compatible():
    from jsonschema import Draft202012Validator
    schema = PRESENT_TOOL["input_schema"]
    Draft202012Validator.check_schema(schema)
    assert '"$ref"' not in json.dumps(schema)
    Draft202012Validator(schema).validate({"narration": "test", "commands": [
        {"op": "daMode", "args": {"mode": "focus", "chunks": [3]}}
    ]})


def test_no_key_keeps_scene_unchanged(data):
    result = respond(Pod.model_validate(data), "focus C3", {}, SimpleNamespace(has_anthropic=False))
    assert result["commands"] == []
    assert "unavailable" in result["narration"]
