from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.state import build_state
from backend.chat import ask

app = FastAPI(title="Airspace Disruption Forecaster")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_STATE = build_state()

class ChatRequest(BaseModel):
    message: str
    event_id: str | None = None

@app.get("/api/state")
def get_state(): return _STATE

@app.post("/api/chat")
def post_chat(req: ChatRequest): return ask(req.message, _STATE)
