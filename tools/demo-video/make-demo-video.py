import asyncio
import json
import os
import re
import shutil
import subprocess
import textwrap
import time
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from moviepy import AudioFileClip
from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist" / "demo-video"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
URL = "http://localhost:8788"
VOICE = "en-US-GuyNeural"


SCENES = [
    {
        "id": "intro_transition",
        "duration": 2,
        "narration": [],
    },
    {
        "id": "workspace",
        "duration": 12,
        "narration": [
            (
                "ChessPrep Lab is built around opening training for match preparation.",
                "ChessPrep Lab centers opening training for match preparation."
            ),
            (
                "Opening repertoires are easy to forget after deep analysis, so the workspace turns prepared lines into repeatable training.",
                "Opening repertoires are easy to forget after deep analysis."
            ),
        ],
    },
    {
        "id": "language",
        "duration": 9,
        "narration": [
            (
                "The interface supports Chinese and English, and the language switch updates the same workspace immediately.",
                "Chinese and English switch inside the same workspace."
            ),
        ],
    },
    {
        "id": "opening_import",
        "duration": 15,
        "narration": [
            (
                "Drop your own prepared openings into the workspace and rehearse them as a memory tree.",
                "Drop your own prepared openings into a memory tree."
            ),
            (
                "Paste PGN, upload a file, import a public study link, or append new variations as your preparation grows.",
                "Paste PGN, upload files, import studies, or append new variations."
            ),
        ],
    },
    {
        "id": "opening_tree",
        "duration": 16,
        "narration": [
            (
                "After import, the trainer groups the repertoire by position instead of by one long PGN line.",
                "Imported openings become a position based training tree."
            ),
            (
                "Multiple replies from the same position stay together, so repeated practice strengthens recall at the exact branch points.",
                "Branch choices repeat the exact positions that are easy to forget."
            ),
        ],
    },
    {
        "id": "board_input",
        "duration": 14,
        "narration": [
            (
                "Training uses normal board input, with click moves and drag moves.",
                "Train by clicking or dragging moves on the board."
            ),
            (
                "Legal destinations, last moves, candidate answers, and opponent branch choices stay visible while you drill the line.",
                "Legal moves, answers, and branch choices stay visible."
            ),
        ],
    },
    {
        "id": "pgn_rewind",
        "duration": 13,
        "narration": [
            (
                "The current line stays visible and can be copied back into your preparation notes.",
                "The current PGN line stays visible and copyable."
            ),
            (
                "Back and forward controls let you review a missed branch without changing the training statistics.",
                "Review missed branches without changing training statistics."
            ),
        ],
    },
    {
        "id": "endgame",
        "duration": 17,
        "narration": [
            (
                "The endgame mode contains three hundred complex positions.",
                "The endgame mode contains 300 complex positions."
            ),
            (
                "Each lesson shows the target result, source information, strategic idea, hints, and the checked continuation.",
                "Each lesson shows the target, source, idea, hints, and continuation."
            ),
        ],
    },
    {
        "id": "engine",
        "duration": 15,
        "narration": [
            (
                "From any current position, you can start off-book Human-Like sparring for match preparation.",
                "Human-Like off-book prep from any position."
            ),
            (
                "The profiles include Stockfish and human-like levels from twenty-two hundred to about twenty-seven hundred, with stronger internal calibration for off-book training.",
                "Human-like 2200 to 2700 labels, stronger internal play."
            ),
        ],
    },
    {
        "id": "saved_studies",
        "duration": 12,
        "narration": [
            (
                "Imported studies can be saved locally, renamed, loaded again, and extended later.",
                "Studies can be saved locally, renamed, reloaded, and extended."
            ),
        ],
    },
    {
        "id": "outro_transition",
        "duration": 2,
        "narration": [],
    },
]


def run(command, *, env=None, check=True):
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(
            f"Command failed: {' '.join(map(str, command))}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result


def ffmpeg():
    return imageio_ffmpeg.get_ffmpeg_exe()


def total_duration():
    return sum(scene["duration"] for scene in SCENES)


def format_srt_time(seconds):
    millis = int(round((seconds - int(seconds)) * 1000))
    whole = int(seconds)
    hours = whole // 3600
    minutes = (whole % 3600) // 60
    secs = whole % 60
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def parse_srt_time(value):
    hours, minutes, rest = value.split(":")
    seconds, millis = rest.split(",")
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def format_ass_time(seconds):
    centis = int(round(seconds * 100))
    hours = centis // 360000
    centis %= 360000
    minutes = centis // 6000
    centis %= 6000
    secs = centis // 100
    centis %= 100
    return f"{hours}:{minutes:02}:{secs:02}.{centis:02}"


def flatten_scene_voice(scene):
    return " ".join(part[0] for part in scene["narration"])


def flatten_scene_caption(scene):
    return " ".join(part[1] for part in scene["narration"])


def wrap_caption(text):
    return "\n".join(textwrap.wrap(text, width=58))


def write_script_files(alignment=None):
    OUT.mkdir(parents=True, exist_ok=True)
    script_path = OUT / "chessprep-lab-demo-script.txt"
    srt_path = OUT / "chessprep-lab-demo-subtitles.srt"
    timeline_path = OUT / "chessprep-lab-demo-timeline.json"

    cursor = 0.0
    timeline = []
    srt_blocks = []
    voice_lines = []
    subtitle_index = 1
    aligned_segments = alignment or []
    aligned_by_scene = {}
    for segment in aligned_segments:
        aligned_by_scene.setdefault(segment["scene_id"], []).append(segment)

    for scene in SCENES:
        scene_voice = flatten_scene_voice(scene)
        scene_caption = flatten_scene_caption(scene)
        scene_segments = aligned_by_scene.get(scene["id"], [])
        if scene_segments:
            start = min(segment.get("scene_start", segment["start"]) for segment in scene_segments)
            end = max(segment.get("scene_end", segment["end"]) for segment in scene_segments)
            duration = end - start
        else:
            start = cursor
            duration = scene["duration"]
            end = cursor + duration

        timeline.append({
            **scene,
            "duration": duration,
            "voice": scene_voice,
            "caption": scene_caption,
            "start": start,
            "end": end
        })
        voice_lines.append(scene_voice)

        for segment in scene_segments:
            if not segment.get("caption"):
                continue
            caption = segment["caption"]
            subtitle_start = segment["start"]
            subtitle_end = segment["end"]
            srt_blocks.append(
                f"{subtitle_index}\n"
                f"{format_srt_time(subtitle_start)} --> {format_srt_time(subtitle_end)}\n"
                f"{wrap_caption(caption)}\n"
            )
            subtitle_index += 1
        cursor = end

    script_path.write_text("\n\n".join(voice_lines), encoding="utf-8")
    srt_path.write_text("\n".join(srt_blocks), encoding="utf-8")
    timeline_path.write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
    return script_path, srt_path, timeline_path


def strip_proxy_env():
    env = os.environ.copy()
    for key in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "GIT_HTTP_PROXY",
        "GIT_HTTPS_PROXY",
    ]:
        env.pop(key, None)
    env["NO_PROXY"] = "localhost,127.0.0.1,::1"
    return env


def synthesize_with_edge_tts(script_path, audio_path):
    text = script_path.read_text(encoding="utf-8")
    command = [
        "python",
        "-m",
        "edge_tts",
        "--voice",
        VOICE,
        "--rate=-6%",
        "--pitch=-1Hz",
        "--text",
        text,
        "--write-media",
        str(audio_path),
    ]
    return run(command, env=strip_proxy_env(), check=False)


async def save_edge_tts_with_word_boundaries(text, audio_path, metadata_path):
    communicate = edge_tts.Communicate(text, VOICE, rate="-6%", pitch="-1Hz", boundary="WordBoundary")
    with open(audio_path, "wb") as audio, open(metadata_path, "w", encoding="utf-8") as metadata:
        async for message in communicate.stream():
            if message["type"] == "audio":
                audio.write(message["data"])
            elif message["type"] == "WordBoundary":
                json.dump(message, metadata, ensure_ascii=False)
                metadata.write("\n")


def synthesize_text_with_edge_tts(text, audio_path, metadata_path=None):
    if not metadata_path:
        metadata_path = Path(audio_path).with_suffix(".jsonl")
    try:
        asyncio.run(save_edge_tts_with_word_boundaries(text, audio_path, metadata_path))
    except Exception as error:
        return subprocess.CompletedProcess(["edge_tts.Communicate"], 1, "", str(error))
    return subprocess.CompletedProcess(["edge_tts.Communicate"], 0, "", "")


def synthesize_with_sapi(script_path, wav_path):
    text = script_path.read_text(encoding="utf-8").replace("'", "''")
    ps = f"""
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Zira Desktop')
$synth.Rate = -1
$synth.Volume = 100
$synth.SetOutputToWaveFile('{str(wav_path).replace("'", "''")}')
$text = @'
{script_path.read_text(encoding="utf-8")}
'@
$synth.Speak($text)
$synth.Dispose()
"""
    run(["powershell", "-NoProfile", "-Command", ps])


def audio_duration(audio_path):
    clip = AudioFileClip(str(audio_path))
    try:
        return float(clip.duration)
    finally:
        clip.close()


def parse_edge_tts_word_bounds(metadata_path):
    if not metadata_path or not Path(metadata_path).exists():
        return None
    words = []
    for line in Path(metadata_path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        message = json.loads(line)
        if message.get("type") != "WordBoundary":
            continue
        start = message["offset"] / 10_000_000
        end = (message["offset"] + message["duration"]) / 10_000_000
        words.append((start, end))
    if not words:
        return None
    return min(start for start, _ in words), max(end for _, end in words)


def forced_align_subtitles():
    segments_dir = OUT / "voice-segments"
    if segments_dir.exists():
        shutil.rmtree(segments_dir)
    segments_dir.mkdir(parents=True)

    manifest_path = OUT / "chessprep-lab-demo-voice-manifest.txt"
    audio_path = OUT / "chessprep-lab-demo-voice.wav"
    alignment = []
    manifest_lines = []
    cursor = 0.0
    index = 0

    for scene in SCENES:
        if not scene["narration"]:
            silence_path = segments_dir / f"{index:03d}-{scene['id']}-aligned.wav"
            run([
                ffmpeg(),
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=48000:cl=stereo",
                "-t",
                f"{scene['duration']:.3f}",
                "-c:a",
                "pcm_s16le",
                str(silence_path),
            ])
            start = cursor
            end = cursor + scene["duration"]
            alignment.append({
                "index": index,
                "scene_id": scene["id"],
                "start": start,
                "end": end,
                "duration": scene["duration"],
                "scene_start": start,
                "scene_end": end,
                "voice": "",
                "caption": "",
                "audio": str(silence_path),
                "silent": True,
            })
            manifest_lines.append(f"file '{silence_path.as_posix()}'")
            cursor = end
            index += 1
            continue

        for voice, caption in scene["narration"]:
            segment_path = segments_dir / f"{index:03d}-{scene['id']}.mp3"
            metadata_path = segments_dir / f"{index:03d}-{scene['id']}.word-boundaries.jsonl"
            result = synthesize_text_with_edge_tts(voice, segment_path, metadata_path)
            if result.returncode != 0 or not segment_path.exists() or segment_path.stat().st_size < 1000:
                fallback_script = segments_dir / f"{index:03d}-{scene['id']}.txt"
                fallback_wav = segments_dir / f"{index:03d}-{scene['id']}.wav"
                fallback_script.write_text(voice, encoding="utf-8")
                synthesize_with_sapi(fallback_script, fallback_wav)
                segment_path = fallback_wav
                metadata_path = None

            normalized_segment = segments_dir / f"{index:03d}-{scene['id']}-aligned.wav"
            run([
                ffmpeg(),
                "-y",
                "-i",
                str(segment_path),
                "-ar",
                "48000",
                "-ac",
                "2",
                "-c:a",
                "pcm_s16le",
                str(normalized_segment),
            ])
            segment_path = normalized_segment

            duration = audio_duration(segment_path)
            tts_start, tts_end = parse_edge_tts_word_bounds(metadata_path) or (0.0, duration)
            tts_start = max(0.0, min(tts_start, duration))
            tts_end = max(tts_start + 0.1, min(tts_end, duration))
            start = cursor
            end = cursor + duration
            alignment.append({
                "index": index,
                "scene_id": scene["id"],
                "start": start + tts_start,
                "end": start + tts_end,
                "duration": duration,
                "scene_start": start,
                "scene_end": end,
                "voice": voice,
                "caption": caption,
                "audio": str(segment_path),
            })
            manifest_lines.append(f"file '{segment_path.as_posix()}'")
            cursor = end
            index += 1

    manifest_path.write_text("\n".join(manifest_lines), encoding="utf-8")
    run([
        ffmpeg(),
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(manifest_path),
        "-c",
        "copy",
        str(audio_path),
    ])
    return audio_path, alignment, cursor


def normalize_audio(audio_path, target_duration):
    duration = audio_duration(audio_path)
    padded = OUT / "chessprep-lab-demo-voice-padded.wav"
    if duration < target_duration:
        pad = target_duration - duration
        run([
            ffmpeg(),
            "-y",
            "-i",
            str(audio_path),
            "-af",
            f"apad=pad_dur={pad:.3f}",
            "-t",
            f"{target_duration:.3f}",
            "-c:a",
            "pcm_s16le",
            str(padded),
        ])
        return padded
    return audio_path


def ensure_server():
    try:
        import urllib.request

        with urllib.request.urlopen(URL, timeout=3) as response:
            if response.status == 200:
                return None
    except Exception:
        pass

    process = subprocess.Popen(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "start-trainer.ps1")],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(40):
        try:
            import urllib.request

            with urllib.request.urlopen(URL, timeout=1) as response:
                if response.status == 200:
                    return process
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("Local ChessPrep Lab server did not start.")


async def wait(scene):
    await asyncio.sleep(scene["duration"])


async def click_square(page, square_name):
    square = page.locator(f'[data-square="{square_name}"]')
    await square.wait_for(state="visible", timeout=10000)
    box = await square.bounding_box()
    await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


async def drag_square(page, source, target):
    source_square = page.locator(f'[data-square="{source}"]')
    target_square = page.locator(f'[data-square="{target}"]')
    await source_square.wait_for(state="visible", timeout=10000)
    s = await source_square.bounding_box()
    t = await target_square.bounding_box()
    await page.mouse.move(s["x"] + s["width"] / 2, s["y"] + s["height"] / 2)
    await page.mouse.down()
    await page.mouse.move(t["x"] + t["width"] / 2, t["y"] + t["height"] / 2, steps=24)
    await page.mouse.up()


async def highlight(page, selector, label=None):
    await page.evaluate(
        """({ selector, label }) => {
            document.querySelectorAll('.demo-highlight').forEach((el) => el.remove());
            const target = document.querySelector(selector);
            if (!target) return;
            const rect = target.getBoundingClientRect();
            const margin = 4;
            const box = document.createElement('div');
            box.className = 'demo-highlight';
            box.dataset.demoSelector = selector;
            box.dataset.targetRect = JSON.stringify({
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height
            });
            box.style.cssText = `
              position: fixed;
              left: ${Math.max(0, rect.left - margin)}px;
              top: ${Math.max(0, rect.top - margin)}px;
              width: ${rect.width + margin * 2}px;
              height: ${rect.height + margin * 2}px;
              border: 3px solid #2ee9ff;
              border-radius: 10px;
              box-shadow: 0 0 0 9999px rgba(7,12,18,.18), 0 0 28px rgba(238,64,220,.55);
              z-index: 9999;
              pointer-events: none;
            `;
            if (label) {
              const tag = document.createElement('div');
              tag.textContent = label;
              tag.style.cssText = `
                position:absolute;
                left: 10px;
                top: -34px;
                padding: 5px 9px;
                border-radius: 8px;
                background: rgba(18,27,34,.92);
                color: white;
                font: 700 13px/1.2 Inter, Segoe UI, sans-serif;
                white-space: nowrap;
              `;
              box.appendChild(tag);
            }
            document.body.appendChild(box);
          }""",
        {"selector": selector, "label": label},
    )


async def clear_highlight(page):
    await page.evaluate("document.querySelectorAll('.demo-highlight').forEach((el) => el.remove())")


async def set_zoom(page, selector, scale=1.06):
    await page.evaluate(
        """({ selector, scale }) => {
          document.body.classList.add('demo-zooming');
          const target = document.querySelector(selector);
          if (!target) return;
          target.style.transformOrigin = 'center center';
          target.style.transform = `scale(${scale})`;
          target.style.transition = 'transform .45s ease';
          target.style.zIndex = '2';
        }""",
        {"selector": selector, "scale": scale},
    )


async def clear_zoom(page):
    await page.evaluate(
        """() => {
          document.querySelectorAll('.board-zone,.training-panel,.import-panel,.topbar').forEach((el) => {
            el.style.transform = '';
            el.style.zIndex = '';
          });
        }"""
    )


async def record_demo(timeline_path):
    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    video_dir = OUT / "recording"
    if video_dir.exists():
        shutil.rmtree(video_dir)
    video_dir.mkdir(parents=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path=str(CHROME),
            args=["--window-size=1920,1080", "--force-device-scale-factor=1"],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            record_video_dir=str(video_dir),
            record_video_size={"width": 1920, "height": 1080},
        )
        video_clock_started_at = time.perf_counter()
        page = await context.new_page()
        await page.goto(URL, wait_until="networkidle")
        recording_offset = time.perf_counter() - video_clock_started_at
        started_at = time.perf_counter()

        async def sleep_until(deadline):
            remaining = deadline - time.perf_counter()
            if remaining > 0:
                await asyncio.sleep(remaining)

        async def sleep_to_progress(scene, progress):
            clamped = min(1.0, max(0.0, progress))
            await sleep_until(started_at + scene["start"] + scene["duration"] * clamped)

        async def cleanup_highlight():
            await clear_highlight(page)

        async def cleanup_board_focus():
            await clear_highlight(page)
            await clear_zoom(page)

        async def finish_scene(scene, cleanup=None):
            cleanup_lead = 0.08 if cleanup else 0.0
            await sleep_until(started_at + scene["end"] - cleanup_lead)
            if cleanup:
                await cleanup()
            await sleep_until(started_at + scene["end"])

        async def play_scene(scene):
            scene_id = scene["id"]
            if scene_id == "intro_transition":
                await highlight(page, ".brand-lockup", "ChessPrep Lab")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "workspace":
                await highlight(page, ".app-shell", "One workspace")
                await sleep_to_progress(scene, 0.43)
                await highlight(page, ".mode-switch", "Opening and endgame modes")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "language":
                await page.click('[data-language-option="en"]')
                await sleep_to_progress(scene, 0.24)
                await highlight(page, ".language-switch", "Bilingual UI")
                await sleep_to_progress(scene, 0.56)
                await page.click('[data-language-option="zh"]')
                await sleep_to_progress(scene, 0.78)
                await page.click('[data-language-option="en"]')
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "opening_import":
                await highlight(page, ".import-panel", "Import and saved studies")
                await page.click("[data-sample]")
                await sleep_to_progress(scene, 0.43)
                await page.fill("[data-pgn-input]", "[Event \"Append demo\"]\\n[Result \"*\"]\\n\\n1. e4 c5 2. Nf3 d6 *")
                await page.click("[data-append-pgn]")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "opening_tree":
                await highlight(page, ".training-panel", "Position-based training tree")
                await sleep_to_progress(scene, 0.28)
                await click_square(page, "e2")
                await click_square(page, "e4")
                await sleep_to_progress(scene, 0.50)
                await click_square(page, "g1")
                await click_square(page, "f3")
                await sleep_to_progress(scene, 0.73)
                await page.click("[data-reveal]")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "board_input":
                await set_zoom(page, ".board-zone", 1.04)
                await highlight(page, ".board", "Click or drag on the board")
                await sleep_to_progress(scene, 0.20)
                await page.click("[data-next]")
                await sleep_to_progress(scene, 0.43)
                await click_square(page, "d2")
                await click_square(page, "d4")
                await sleep_to_progress(scene, 0.72)
                await drag_square(page, "c2", "c4")
                await finish_scene(scene, cleanup_board_focus)
            elif scene_id == "pgn_rewind":
                await highlight(page, ".current-line-panel", "Copy PGN and rewind")
                await sleep_to_progress(scene, 0.35)
                await page.click("[data-copy-pgn]")
                await sleep_to_progress(scene, 0.58)
                await page.click("[data-back-step]")
                await sleep_to_progress(scene, 0.78)
                await page.keyboard.press("ArrowRight")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "endgame":
                await page.click('[data-mode-switch="endgame"]')
                await sleep_to_progress(scene, 0.18)
                await page.click('[data-language-option="en"]')
                await highlight(page, "[data-endgame-left]", "Complex endgame course")
                await sleep_to_progress(scene, 0.58)
                await page.click("[data-endgame-hint]")
                await sleep_to_progress(scene, 0.82)
                await page.click("[data-endgame-answer]")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "engine":
                await highlight(page, "[data-endgame-right] .engine-card", "Human-like sparring")
                await sleep_to_progress(scene, 0.45)
                await page.locator('[data-endgame-right] [data-engine-profile="human-2400"]').click()
                await sleep_to_progress(scene, 0.72)
                await page.locator('[data-endgame-right] [data-engine-profile="human-2700"]').click()
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "saved_studies":
                await page.click('[data-mode-switch="opening"]')
                await sleep_to_progress(scene, 0.15)
                await highlight(page, ".saved-studies", "Saved studies")
                await finish_scene(scene, cleanup_highlight)
            elif scene_id == "outro_transition":
                await highlight(page, ".brand-lockup", "ChessPrep Lab")
                await finish_scene(scene, cleanup_highlight)

        for scene in timeline:
            await play_scene(scene)

        await context.close()
        await browser.close()

    videos = sorted(video_dir.glob("*.webm"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not videos:
        raise RuntimeError("Playwright did not produce a recording.")
    raw = OUT / "chessprep-lab-demo-raw.webm"
    shutil.copy2(videos[0], raw)
    (OUT / "chessprep-lab-demo-recording-offset.json").write_text(json.dumps({
        "video_offset_seconds": recording_offset,
        "target_duration_seconds": timeline[-1]["end"] if timeline else 0
    }, indent=2), encoding="utf-8")
    return raw, recording_offset


def ass_subtitle_path(srt_path):
    ass = OUT / "chessprep-lab-demo-subtitles.ass"
    style = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1920\n"
        "PlayResY: 1080\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Default,Segoe UI Semibold,42,&H00FFFFFF,&H000000FF,&HCC000000,&H96000000,0,0,0,0,100,100,0,0,4,3,1,8,210,210,72,1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    events = []
    block_re = re.compile(r"(\d+)\n([0-9:,]+) --> ([0-9:,]+)\n(.+?)(?=\n\n|\Z)", re.S)
    for match in block_re.finditer(srt_path.read_text(encoding="utf-8")):
        start = format_ass_time(parse_srt_time(match.group(2)))
        end = format_ass_time(parse_srt_time(match.group(3)))
        text = (
            match.group(4)
            .replace("\\", r"\\")
            .replace("{", r"\{")
            .replace("}", r"\}")
            .replace("\n", r"\N")
        )
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n")
    ass.write_text(style + "".join(events), encoding="utf-8")
    return ass


def compose_video(raw_video, audio_path, srt_path, video_offset=0.0, target_duration=None):
    ass = ass_subtitle_path(srt_path)
    final = OUT / "ChessPrep-Lab-English-Demo.mp4"
    ass_arg = str(ass).replace("\\", "/").replace(":", r"\:")
    duration = target_duration if target_duration is not None else audio_duration(audio_path)
    run([
        ffmpeg(),
        "-y",
        "-i",
        str(raw_video),
        "-i",
        str(audio_path),
        "-filter_complex",
        f"[0:v]trim=start={max(0.0, video_offset):.3f}:duration={duration:.3f},fps=30,setpts=PTS-STARTPTS,scale=1920:1080,subtitles='{ass_arg}'[v]",
        "-map",
        "[v]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(final),
    ])
    return final


def main():
    server_process = ensure_server()
    write_script_files()
    audio_path, alignment, target = forced_align_subtitles()
    script_path, srt_path, timeline_path = write_script_files(alignment)
    padded_audio = normalize_audio(audio_path, target)
    raw_video, video_offset = asyncio.run(record_demo(timeline_path))
    final = compose_video(raw_video, padded_audio, srt_path, video_offset, target)

    if server_process:
        server_process.terminate()

    print(json.dumps({
        "script": str(script_path),
        "subtitles": str(srt_path),
        "raw_video": str(raw_video),
        "audio": str(padded_audio),
        "final": str(final),
        "duration_seconds": target,
        "video_offset_seconds": video_offset,
        "voice": VOICE,
    }, indent=2))


if __name__ == "__main__":
    main()
