import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Video, Square, Circle, Camera, Monitor, RotateCcw,
  Upload, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";

interface VideoRecorderProps {
  onVideoUploaded: (url: string) => void;
  onClose: () => void;
}

interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind: string;
}

export function VideoRecorder({ onVideoUploaded, onClose }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [sourceType, setSourceType] = useState<"camera" | "screen">("camera");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const recordedUrlRef = useRef<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setRecordedUrlTracked = (url: string) => {
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    recordedUrlRef.current = url;
    setRecordedUrl(url);
  };

  const loadDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList
        .filter(d => d.kind === "videoinput")
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: d.kind,
        }));
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err: any) {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    loadDevices();
    return () => {
      stopStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startPreview = async () => {
    stopStream();
    setError("");
    try {
      let stream: MediaStream;
      if (sourceType === "screen") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch {}
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setError(sourceType === "screen"
        ? "Screen sharing was cancelled or denied."
        : "Could not access the selected camera. Try a different device.");
    }
  };

  useEffect(() => {
    if (!recordedBlob) {
      startPreview();
    }
  }, [selectedDeviceId, sourceType]);

  const startRecording = () => {
    if (!streamRef.current) return;
    setError("");
    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrlTracked("");
    setDuration(0);

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    let selectedMime = "";
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: selectedMime || undefined,
        videoBitsPerSecond: 2500000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: selectedMime || "video/webm",
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrlTracked(url);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to start recording. Your browser may not support this feature.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    stopStream();
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    setIsPaused(!isPaused);
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordedUrlTracked("");
    setDuration(0);
    setError("");
    startPreview();
  };

  const uploadRecording = async () => {
    if (!recordedBlob) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError("");

    try {
      const signedRes = await fetch("/api/upload/request-signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await signedRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onVideoUploaded(objectPath);
            stopStream();
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", recordedBlob.type || "video/webm");
        xhr.send(recordedBlob);
      });
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="border-2 border-primary/30 rounded-xl bg-gradient-to-b from-background to-muted/30 overflow-hidden" data-testid="video-recorder">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Video Recorder</span>
        </div>
        {!isRecording && (
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-recorder">
            Close
          </Button>
        )}
      </div>

      {!recordedBlob && (
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button
              variant={sourceType === "camera" ? "default" : "outline"}
              size="sm"
              onClick={() => { setSourceType("camera"); }}
              disabled={isRecording}
              data-testid="button-source-camera"
            >
              <Camera className="w-4 h-4 mr-1" /> Camera
            </Button>
            <Button
              variant={sourceType === "screen" ? "default" : "outline"}
              size="sm"
              onClick={() => { setSourceType("screen"); }}
              disabled={isRecording}
              data-testid="button-source-screen"
            >
              <Monitor className="w-4 h-4 mr-1" /> Screen
            </Button>
          </div>

          {sourceType === "camera" && devices.length > 1 && !isRecording && (
            <div>
              <Label className="text-xs">Video Device</Label>
              <select
                className="w-full mt-1 text-sm border rounded-md px-3 py-1.5 bg-background"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                data-testid="select-camera-device"
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="relative aspect-video bg-black">
        {!recordedBlob ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            data-testid="recorder-preview"
          />
        ) : (
          <video
            src={recordedUrl}
            className="w-full h-full object-contain"
            controls
            playsInline
            data-testid="recorder-playback"
          />
        )}

        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
            <div className={`w-3 h-3 rounded-full ${isPaused ? "bg-yellow-400" : "bg-red-500 animate-pulse"}`} />
            <span className="text-white text-sm font-mono">{formatTime(duration)}</span>
            {isPaused && <span className="text-yellow-400 text-xs">PAUSED</span>}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" data-testid="recorder-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!recordedBlob ? (
          <div className="flex gap-2 justify-center">
            {!isRecording ? (
              <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700" data-testid="button-start-recording">
                <Circle className="w-4 h-4 mr-1 fill-current" /> Start Recording
              </Button>
            ) : (
              <>
                <Button onClick={togglePause} variant="outline" data-testid="button-pause-recording">
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button onClick={stopRecording} variant="destructive" data-testid="button-stop-recording">
                  <Square className="w-4 h-4 mr-1 fill-current" /> Stop
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Duration: {formatTime(duration)}</span>
              <span>Size: {(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB</span>
            </div>

            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <Button onClick={resetRecording} variant="outline" disabled={isUploading} data-testid="button-retake">
                <RotateCcw className="w-4 h-4 mr-1" /> Retake
              </Button>
              <Button onClick={uploadRecording} disabled={isUploading} data-testid="button-upload-recording">
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-1" /> Use This Video</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
