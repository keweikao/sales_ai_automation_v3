import { Mic, MicOff, Pause, Play, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number; // in seconds
  className?: string;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

function getVisualizationBgClass(state: RecordingState): string {
  switch (state) {
    case "recording":
      return "bg-red-100 dark:bg-red-900/30";
    case "paused":
      return "bg-yellow-100 dark:bg-yellow-900/30";
    case "stopped":
      return "bg-green-100 dark:bg-green-900/30";
    default:
      return "bg-muted";
  }
}

function MicIcon({ state }: { state: RecordingState }) {
  if (state === "recording") {
    return <Mic className="h-10 w-10 animate-pulse text-red-500" />;
  }
  if (state === "paused") {
    return <MicOff className="h-10 w-10 text-yellow-500" />;
  }
  return <Mic className="h-10 w-10 text-muted-foreground" />;
}

function getStatusText(state: RecordingState): string {
  switch (state) {
    case "recording":
      return "錄音中...";
    case "paused":
      return "已暫停";
    case "stopped":
      return "錄音完成";
    default:
      return "準備就緒";
  }
}

export function AudioRecorder({
  onRecordingComplete,
  maxDuration = 3600, // 1 hour default
  className,
}: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Auto-stop when max duration reached
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopRecording is stable and doesn't need to be in deps
  useEffect(() => {
    if (duration >= maxDuration && recordingState === "recording") {
      stopRecording();
    }
  }, [duration, maxDuration, recordingState]);

  const updateAudioLevel = useCallback(() => {
    if (!analyzerRef.current) {
      return;
    }

    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);

    if (recordingState === "recording") {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [recordingState]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analyzer for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onRecordingComplete(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      setRecordingState("recording");
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start audio level visualization
      updateAudioLevel();
    } catch (err) {
      console.error("Failed to start recording:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("請允許麥克風權限以進行錄音");
        } else if (err.name === "NotFoundError") {
          setError("找不到麥克風裝置");
        } else {
          setError("無法啟動錄音");
        }
      }
    }
  }, [onRecordingComplete, updateAudioLevel]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [recordingState]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");

      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      updateAudioLevel();
    }
  }, [recordingState, updateAudioLevel]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingState("stopped");

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setDuration(0);
    setRecordingState("idle");
    setAudioLevel(0);
    chunksRef.current = [];
  }, [audioUrl]);

  const isRecording = recordingState === "recording";
  const isPaused = recordingState === "paused";
  const isStopped = recordingState === "stopped";
  const isIdle = recordingState === "idle";

  return (
    <Card className={className}>
      <CardContent className="p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 text-sm dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center">
          {/* Visualization */}
          <div className="relative mb-6">
            <div
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full transition-all",
                getVisualizationBgClass(recordingState)
              )}
              style={{
                transform: isRecording
                  ? `scale(${1 + audioLevel * 0.2})`
                  : "scale(1)",
                transition: "transform 0.1s ease-out",
              }}
            >
              <MicIcon state={recordingState} />
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute -top-1 -right-1 h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="mb-4 text-center">
            <div className="font-bold font-mono text-3xl">
              {formatDuration(duration)}
            </div>
            <div className="text-muted-foreground text-sm">
              {getStatusText(recordingState)}
            </div>
            {maxDuration && (
              <div className="mt-1 text-muted-foreground text-xs">
                最長錄音時間: {formatDuration(maxDuration)}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {isIdle && (
              <Button onClick={startRecording} size="lg">
                <Mic className="mr-2 h-5 w-5" />
                開始錄音
              </Button>
            )}

            {isRecording && (
              <>
                <Button onClick={pauseRecording} variant="outline">
                  <Pause className="mr-2 h-4 w-4" />
                  暫停
                </Button>
                <Button onClick={stopRecording} variant="destructive">
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              </>
            )}

            {isPaused && (
              <>
                <Button onClick={resumeRecording}>
                  <Play className="mr-2 h-4 w-4" />
                  繼續
                </Button>
                <Button onClick={stopRecording} variant="destructive">
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              </>
            )}

            {isStopped && (
              <Button onClick={resetRecording} variant="outline">
                <Trash2 className="mr-2 h-4 w-4" />
                重新錄音
              </Button>
            )}
          </div>

          {/* Audio Preview */}
          {audioUrl && isStopped && (
            <div className="mt-6 w-full">
              <p className="mb-2 text-center text-muted-foreground text-sm">
                錄音預覽
              </p>
              {/* biome-ignore lint/a11y/useMediaCaption: This is a user-recorded audio without captions */}
              <audio
                aria-label="錄音預覽"
                className="w-full"
                controls
                src={audioUrl}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
