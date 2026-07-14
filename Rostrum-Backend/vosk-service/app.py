import json
import os
import subprocess
import tempfile
import wave
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from vosk import KaldiRecognizer, Model, SetLogLevel

MODEL_PATH = os.environ.get("VOSK_MODEL_PATH", "/models/vosk-model")
SERVICE_TOKEN = os.environ.get("VOSK_SERVICE_TOKEN", "")
MAX_AUDIO_BYTES = int(os.environ.get("VOSK_MAX_AUDIO_BYTES", str(10 * 1024 * 1024)))
FFMPEG_TIMEOUT_SEC = int(os.environ.get("VOSK_FFMPEG_TIMEOUT_SEC", "60"))

SetLogLevel(-1)
model = Model(MODEL_PATH)
app = FastAPI(title="Rostrum Vosk Service", version="1.0.0")


def authorize(authorization: str | None) -> None:
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid service token")


def convert_to_pcm_wav(source: Path, target: Path) -> None:
    try:
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(source), "-ac", "1", "-ar", "16000",
                "-c:a", "pcm_s16le", str(target),
            ],
            check=True,
            capture_output=True,
            timeout=FFMPEG_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=422, detail="Audio conversion timeout") from error
    except subprocess.CalledProcessError as error:
        detail = error.stderr.decode("utf-8", errors="replace")[-500:]
        raise HTTPException(status_code=422, detail=f"Invalid audio: {detail}") from error


def result_to_segment(result: dict) -> dict | None:
    text = str(result.get("text", "")).strip()
    words = result.get("result") or []
    if not text or not words:
        return None

    confidence_values = [float(word["conf"]) for word in words if "conf" in word]
    confidence = (
        sum(confidence_values) / len(confidence_values)
        if confidence_values else None
    )
    return {
        "start_ms": round(float(words[0]["start"]) * 1000),
        "end_ms": round(float(words[-1]["end"]) * 1000),
        "text": text,
        "confidence": confidence,
    }


def recognize(wav_path: Path) -> tuple[list[dict], int]:
    segments: list[dict] = []
    with wave.open(str(wav_path), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise HTTPException(status_code=500, detail="Internal PCM conversion error")

        sample_rate = audio.getframerate()
        duration_ms = round(audio.getnframes() / sample_rate * 1000)
        recognizer = KaldiRecognizer(model, sample_rate)
        recognizer.SetWords(True)

        while True:
            data = audio.readframes(4000)
            if not data:
                break
            if recognizer.AcceptWaveform(data):
                segment = result_to_segment(json.loads(recognizer.Result()))
                if segment:
                    segments.append(segment)

        final_segment = result_to_segment(json.loads(recognizer.FinalResult()))
        if final_segment:
            segments.append(final_segment)

    return segments, duration_ms


@app.get("/health")
def health() -> dict:
    return {"status": "healthy", "model_path": MODEL_PATH}


@app.post("/v1/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("ru"),
    authorization: str | None = Header(default=None),
) -> dict:
    authorize(authorization)
    payload = await audio.read(MAX_AUDIO_BYTES + 1)
    if not payload:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio chunk is too large")

    suffix = Path(audio.filename or "chunk.webm").suffix or ".bin"
    with tempfile.TemporaryDirectory(prefix="rostrum-vosk-") as directory:
        source = Path(directory) / f"input{suffix}"
        target = Path(directory) / "audio.wav"
        source.write_bytes(payload)
        convert_to_pcm_wav(source, target)
        segments, duration_ms = recognize(target)

    return {
        "contract_version": "1.0.0",
        "language": language,
        "duration_ms": duration_ms,
        "segments": segments,
        "text": " ".join(segment["text"] for segment in segments),
    }
