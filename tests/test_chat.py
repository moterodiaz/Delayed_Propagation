from backend.chat import fallback_answer, build_facts
from backend.state import build_state

def test_fallback_known_prompt():
    a = fallback_answer("What should I do about JBU1575?")
    assert a and ("pre-empt" in a.lower() or "preempt" in a.lower())

def test_fallback_unknown_returns_generic():
    a = fallback_answer("totally unrelated pizza question")
    assert a and len(a) > 0

def test_build_facts_has_numbers():
    f = build_facts(build_state())
    assert "$" in f and "JBU1575" in f and "coordinated" in f.lower()
