"use client"
import { useCallback, useEffect, useRef, useState, PointerEvent } from "react";
import { Pause, Play } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  type?: string;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const AudioPlayer = ({ src, type }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const resolvingDurationRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const knownDuration = Number.isFinite(duration) && duration > 0;
  const progress = knownDuration ? Math.min(100, (current / duration) * 100) : 0;

  const applyDuration = useCallback((value: number) => {
    if (Number.isFinite(value) && value > 0) {
      setDuration(value);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (draggingRef.current || resolvingDurationRef.current) return;
      setCurrent(audio.currentTime);
    };
    const onDurationChange = () => applyDuration(audio.duration);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        applyDuration(audio.duration);
        return;
      }
      // Some browsers (Chrome + webm) report Infinity until the file has
      // been seeked to the end once. Jump there, read the real length, then
      // rewind - without this the bar has no scale and stays a static dot.
      if (audio.duration === Infinity) {
        resolvingDurationRef.current = true;
        const onSeeked = () => {
          audio.removeEventListener("timeupdate", onSeeked);
          applyDuration(audio.duration);
          audio.currentTime = 0;
          setCurrent(0);
          resolvingDurationRef.current = false;
        };
        audio.addEventListener("timeupdate", onSeeked);
        audio.currentTime = 1e101;
      }
    };
    const onPlay = () => {
      setPlaying(true);
      document.querySelectorAll("audio").forEach(other => {
        if (other !== audio) other.pause();
      });
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [applyDuration, src]);

  const seekFromClientX = (clientX: number) => {
    const audio = audioRef.current;
    const bar = barRef.current;
    if (!audio || !bar || !knownDuration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = ratio * duration;
    audio.currentTime = next;
    setCurrent(next);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const onBarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  };

  const onBarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekFromClientX(event.clientX);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  return (
    // Native <audio controls> on Android/Huawei collapses the seek track to a
    // lone knob, and a <video> tag would reserve a poster frame we don't want
    // for a voice note. Custom compact bar: play + track + time, no video box.
    <div
      className="flex items-center gap-2.5 w-full min-w-[200px] max-w-[280px] py-1"
      onClick={event => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-800 hover:bg-white"
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={barRef}
          role="slider"
          aria-label="Voice message progress"
          aria-valuemin={0}
          aria-valuemax={knownDuration ? Math.round(duration) : 0}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
          tabIndex={0}
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={event => {
            if (!audioRef.current || !knownDuration) return;
            const step = duration / 20;
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              audioRef.current.currentTime = Math.min(duration, current + step);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              audioRef.current.currentTime = Math.max(0, current - step);
            }
          }}
          className="relative h-2 w-full cursor-pointer rounded-full bg-white/35 touch-none"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] leading-none tabular-nums text-white/90">
          <span>{formatTime(current)}</span>
          <span>{knownDuration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      <audio ref={audioRef} preload="metadata" className="hidden">
        <source src={src} type={type} />
      </audio>
    </div>
  );
};

export default AudioPlayer;
