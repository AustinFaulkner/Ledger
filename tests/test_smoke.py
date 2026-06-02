"""Offline smoke tests — no network / API calls, safe for CI."""

from qoe import qoe
from qoe.ingest import Chunk
from qoe.llm import _extract_json


def test_extract_json_strips_prose():
    assert _extract_json('here you go: {"a": 1} thanks') == '{"a": 1}'


def test_extract_json_strips_fences():
    assert _extract_json('```json\n{"a": 1}\n```') == '{"a": 1}'


def test_qoe_report_schema_constructs():
    report = qoe.QoEReport(
        reported_ebitda=100.0,
        adjustments=[],
        normalized_ebitda=100.0,
        summary="ok",
    )
    assert report.normalized_ebitda == 100.0


def test_chunk_record():
    c = Chunk(text="hello", source="f.pdf", locator="p.1")
    assert c.source == "f.pdf" and c.locator == "p.1"
