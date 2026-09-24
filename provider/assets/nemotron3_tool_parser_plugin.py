# Nemotron 3.x tool-call parser plugin for vLLM nightly (0.27+, vllm/tool_parsers era).
# Format (per NVIDIA chat_template.jinja):
#   <tool_call>
#   <function=name>
#   <parameter=k1>
#   value
#   </parameter>
#   ...
#   </function>
#   </tool_call>
# Register: --tool-parser-plugin /mnt/d/qwen_setup/nemotron3_tool_parser_plugin.py
#           --tool-call-parser nemotron3 --enable-auto-tool-choice

import json
import logging
import re
from typing import Any, Iterable, Sequence

from vllm.entrypoints.openai.chat_completion.protocol import (
    ChatCompletionRequest,
    DeltaMessage,
)
from vllm.entrypoints.openai.engine.protocol import (
    DeltaFunctionCall,
    DeltaToolCall,
    ExtractedToolCallInformation,
    FunctionCall,
    ToolCall,
)
from vllm.tool_parsers import ToolParser, ToolParserManager

logger = logging.getLogger(__name__)

RE_TOOLCALL = re.compile(
    r"<tool_call>\s*<function=([^>]+)>(.*?)</function>\s*</tool_call>",
    re.DOTALL,
)
RE_PARAM = re.compile(
    r"<parameter=([^>]+)>\n?(.*?)\n?</parameter>", re.DOTALL
)


def _parse_value(raw: str) -> Any:
    s = raw.strip()
    try:
        return json.loads(s)
    except Exception:
        return raw


class Nemotron3ToolParser(ToolParser):
    tool_calls_start_token = "<tool_call>"
    tool_calls_end_token = "</tool_call>"

    def __init__(self, tokenizer, tools=None):
        super().__init__(tokenizer, tools=tools)
        self.name = "nemotron3"
        self._streamed_call_idx: int = 0

    # ---------- non-streaming ----------
    def extract_tool_calls(self, model_output: str, request):
        if "<tool_call>" not in model_output:
            return ExtractedToolCallInformation(tools_called=False, tool_calls=[], content=model_output)

        calls: list[ToolCall] = []
        for m in RE_TOOLCALL.finditer(model_output):
            fname = m.group(1).strip()
            body = m.group(2)
            args = {
                k.strip(): _parse_value(v)
                for k, v in RE_PARAM.findall(body)
            }
            calls.append(
                ToolCall(
                    id=f"call_{self._streamed_call_idx}_{fname[:16]}",
                    type="function",
                    function=FunctionCall(name=fname, arguments=json.dumps(args, ensure_ascii=False)),
                )
            )
            self._streamed_call_idx += 1

        content = model_output.split(self.tool_calls_start_token)[0].strip()
        ok = len(calls) > 0 and all(c.function.arguments != "" for c in calls)
        return ExtractedToolCallInformation(
            tools_called=ok,
            tool_calls=calls,
            content=content if content else None,
        )

    # ---------- streaming (buffered; emits each call once when closed) ----------
    def extract_tool_calls_streaming(self, previous_text, current_text, delta_text,
                                     previous_token_ids, current_token_ids,
                                     delta_token_ids, request) -> DeltaMessage | None:
        # wait until at least one complete <tool_call>...</tool_call>
        start = current_text.find(self.tool_calls_start_token)
        if start == -1:
            # no tool call at all — pass through as normal content
            return DeltaMessage(content=delta_text) if delta_text else None
        end = current_text.find(self.tool_calls_end_token, start)
        if end == -1:
            return None  # not closed yet — suppress partial tool markup

        if self.current_tool_id < 0:
            self.current_tool_id = 0

        # count fully-closed calls seen so far in the stream
        n_closed = current_text.count(self.tool_calls_end_token)

        while self._streamed_call_idx < n_closed:
            # parse the (next) closed call
            search_from = 0
            chunk = None
            for _ in range(n_closed):
                s = current_text.find(self.tool_calls_start_token, search_from)
                e = current_text.find(self.tool_calls_end_token, s)
                if s == -1 or e == -1:
                    break
                block = current_text[s:e + len(self.tool_calls_end_token)]
                search_from = e + len(self.tool_calls_end_token)
            info = self.extract_tool_calls(block, request)
            if not (info.tools_called and info.tool_calls):
                break
            tc = info.tool_calls[0]
            idx = self.current_tool_id
            delta = DeltaToolCall(
                index=idx,
                id=tc.id,
                type="function",
                function=DeltaFunctionCall(
                    name=tc.function.name,
                    arguments=tc.function.arguments,
                ),
            )
            self._streamed_call_idx += 1
            self.current_tool_id = idx + 1
            return DeltaMessage(tool_calls=[delta])
        return None


def _register():
    # signature: (name=None, force=True, module=None)
    try:
        ToolParserManager.register_module("nemotron3", module=Nemotron3ToolParser)
    except Exception as e:  # fallback: decorator form
        logger.warning("direct register failed (%s), trying decorator form", e)
        ToolParserManager.register_module(name="nemotron3")(Nemotron3ToolParser)


_register()
logger.info("nemotron3 tool parser registered")
