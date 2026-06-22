import sys
import os
import time
import warnings

# ── Suppress noisy HF / ctranslate2 warnings ──────────────────────
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

import logging
logging.getLogger("faster_whisper").setLevel(logging.ERROR)
logging.getLogger("ctranslate2").setLevel(logging.ERROR)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

import pyaudio
from RealtimeSTT import AudioToTextRecorder

import torch
torch.hub.set_dir(os.path.expanduser('~/.cache/torch/hub'))
try:
    torch.hub.load(
        repo_or_dir='snakers4/silero-vad',
        model='silero_vad',
        trust_repo=True,
        verbose=False
    )
except Exception:
    pass

import atexit

def main():
    print("STATUS:initializing")
    sys.stdout.flush()

    try:
        device_index = None  # Auto-detect default mic
        
        # Verify microphone availability using PyAudio
        try:
            p = pyaudio.PyAudio()
            try:
                try:
                    default_device = p.get_default_input_device_info()
                    device_name = default_device.get('name', 'Default Microphone')
                    print(f"STATUS:using_device_{device_name}")
                except IOError:
                    # No default input device found, check for any input device
                    device_count = p.get_device_count()
                    input_device_indices = [i for i in range(device_count) if p.get_device_info_by_index(i).get('maxInputChannels', 0) > 0]
                    if not input_device_indices:
                        print("STATUS:error_no_microphone")
                        sys.stdout.flush()
                        sys.exit(1)
                    else:
                        device_index = input_device_indices[0]
                        device_info = p.get_device_info_by_index(device_index)
                        device_name = device_info.get('name', f'Device #{device_index}')
                        print(f"STATUS:using_device_{device_name}")
            finally:
                p.terminate()
        except Exception as e:
            print(f"STATUS:error_checking_devices {str(e)}")
            sys.stdout.flush()

        sys.stdout.flush()

        # ── Detect CUDA availability ──────────────────────────────
        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
            print(f"STATUS:gpu_detected_{torch.cuda.get_device_name(0)}")
        else:
            device = "cpu"
            compute_type = "int8"
            print("STATUS:gpu_not_available_using_cpu")
        sys.stdout.flush()

        recorder_config = {
            "model": "tiny",
            "language": "en",
            "device": device,
            "compute_type": compute_type,
            "wake_words": "hey_jarvis", 
            "wakeword_backend": "openwakeword",
            "silero_sensitivity": 0.3,
            "use_extended_logging": False
        }
        if device_index is not None:
            recorder_config["input_device_index"] = device_index

        recorder = AudioToTextRecorder(**recorder_config)
        
        def cleanup():
            try:
                recorder.shutdown()
            except Exception:
                pass
        atexit.register(cleanup)
        
        print("STATUS:ready")
        sys.stdout.flush()

        while True:
            try:
                text = recorder.text()
                if text:
                    # RealtimeSTT usually returns text including the wake word if not configured otherwise
                    # But it handles the trigger logic internally.
                    print(f"TEXT:{text}")
                    sys.stdout.flush()
            except Exception as e:
                print(f"STATUS:error {str(e)}")
                sys.stdout.flush()
                time.sleep(3)
                
    except Exception as e:
        print(f"STATUS:error {str(e)}")
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    main()
