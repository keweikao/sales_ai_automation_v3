import {
  FastForward,
  Pause,
  Play,
  Rewind,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ConversationPlayerProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

function PlayButtonIcon({
  isLoading,
  isPlaying,
}: {
  isLoading: boolean;
  isPlaying: boolean;
}) {
  if (isLoading) {
    return (
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
    );
  }
  if (isPlaying) {
    return <Pause className="h-5 w-5" />;
  }
  return <Play className="ml-0.5 h-5 w-5" />;
}

export function ConversationPlayer({
  audioUrl,
  onTimeUpdate,
  className,
}: ConversationPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Failed to play audio:", err);
        setError("無法播放音檔");
      });
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number | readonly number[]) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const newTime = Array.isArray(value) ? value[0] : value;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleVolumeChange = useCallback(
    (value: number | readonly number[]) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const newVolume = Array.isArray(value) ? value[0] : value;
      audio.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    },
    []
  );

  const handleMuteToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isMuted) {
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleSkip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const newTime = Math.max(
      0,
      Math.min(audio.duration, audio.currentTime + seconds)
    );
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError("音檔載入失敗");
      setIsLoading(false);
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [onTimeUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkip(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkip(10);
          break;
        case "m":
          e.preventDefault();
          handleMuteToggle();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkip, handleMuteToggle]);

  if (error) {
    return (
      <Card className={cn("bg-red-50 dark:bg-red-950", className)}>
        <CardContent className="flex items-center justify-center p-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {/* biome-ignore lint/a11y/useMediaCaption: Captions will be provided via transcript-viewer component */}
        <audio preload="metadata" ref={audioRef} src={audioUrl} />

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            aria-label="音檔進度"
            className="cursor-pointer"
            disabled={isLoading}
            max={duration || 100}
            onValueChange={handleSeek}
            step={0.1}
            value={[currentTime]}
          />
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(Math.floor(duration))}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between">
          {/* Main Controls */}
          <div className="flex items-center gap-2">
            <Button
              aria-label="後退 10 秒"
              disabled={isLoading}
              onClick={() => handleSkip(-10)}
              size="icon"
              variant="ghost"
            >
              <Rewind className="h-4 w-4" />
            </Button>

            <Button
              aria-label={isPlaying ? "暫停" : "播放"}
              className="h-12 w-12 rounded-full"
              disabled={isLoading}
              onClick={handlePlayPause}
              size="icon"
              variant="default"
            >
              <PlayButtonIcon isLoading={isLoading} isPlaying={isPlaying} />
            </Button>

            <Button
              aria-label="快進 10 秒"
              disabled={isLoading}
              onClick={() => handleSkip(10)}
              size="icon"
              variant="ghost"
            >
              <FastForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Button
              aria-label={isMuted ? "取消靜音" : "靜音"}
              onClick={handleMuteToggle}
              size="icon"
              variant="ghost"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              aria-label="音量"
              className="w-24"
              max={1}
              onValueChange={handleVolumeChange}
              step={0.01}
              value={[isMuted ? 0 : volume]}
            />
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-3 text-center text-muted-foreground text-xs">
          快捷鍵: 空白鍵 播放/暫停 | ← → 跳轉 10 秒 | M 靜音
        </div>
      </CardContent>
    </Card>
  );
}
