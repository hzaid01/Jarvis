import sys
import os
import io
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

def transcribe():
    try:
        # Read audio from stdin
        audio_bytes = sys.stdin.buffer.read()
        if not audio_bytes:
            return

        # Convert raw bytes to numpy array using soundfile
        audio_buffer = io.BytesIO(audio_bytes)
        audio_data, sample_rate = sf.read(audio_buffer)
        
        # Convert to float32 (Faster Whisper requirement)
        audio_float = audio_data.astype(np.float32)

        # Load model with cuda if available
        try:
            model = WhisperModel("small", device="cuda", compute_type="float16")
        except Exception:
            model = WhisperModel("small", device="cpu", compute_type="int8")
        
        segments, info = model.transcribe(
            audio_float,
            beam_size=5,
            language="en",
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            log_prob_threshold=-1.0
        )
        
        # Combine segments
        transcription = " ".join([segment.text for segment in segments])
        print(transcription.strip())
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Supress extraneous warnings
    import warnings
    warnings.filterwarnings("ignore")
    
    transcribe()
