"""Explicit DA contracts. Existing transformer schemas remain independent."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Chunk(StrictModel):
    id: int = Field(ge=1, le=16)
    label: str
    tokens: int = Field(ge=1, le=1000000)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")


class MemoryConfig(StrictModel):
    chunks: list[Chunk] = Field(min_length=1, max_length=8)
    scaffold_tokens: int = Field(ge=1)
    kv_heads: int = Field(ge=1, le=128)
    head_dimension: int = Field(ge=1, le=512)
    bytes_per_value: int = Field(ge=1, le=8)

    @model_validator(mode="after")
    def unique_chunks(self):
        if len({chunk.id for chunk in self.chunks}) != len(self.chunks):
            raise ValueError("Chunk IDs must be unique")
        return self


class MemoryScene(StrictModel):
    type: Literal["gpu-memory"]
    params: MemoryConfig


class StageArgs(StrictModel):
    stage: Literal["empty", "weights", "request", "prefill", "decode"]


class ModeArgs(StrictModel):
    mode: Literal["global", "focus", "local"]
    chunks: list[int] = Field(default_factory=list, max_length=8)


class DecodeArgs(StrictModel):
    text: str = Field(max_length=80)


class StageCommand(StrictModel):
    op: Literal["daStage"]
    args: StageArgs


class ModeCommand(StrictModel):
    op: Literal["daMode"]
    args: ModeArgs


class DecodeCommand(StrictModel):
    op: Literal["daDecode"]
    args: DecodeArgs


DACommand = Annotated[StageCommand | ModeCommand | DecodeCommand, Field(discriminator="op")]


class DABeat(StrictModel):
    id: str
    title: str
    text: str
    commands: list[DACommand]
    hold_ms: int = Field(default=900, ge=0, le=10000)


class DAResult(StrictModel):
    narration: str = Field(max_length=1200)
    commands: list[DACommand] = Field(max_length=6)
