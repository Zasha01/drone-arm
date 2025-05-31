import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "lucide-react";

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface VideoFeedProps {
  title: string;
  streamPath: string;
  icon?: React.ReactNode;
}

export function VideoFeed({ title, streamPath, icon }: VideoFeedProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameCountRef = useRef(0);
  const lastDetectionRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up RealSense stream
    const setupStream = async () => {
      try {
        // Request access to the RealSense camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        
        streamRef.current = stream;
        
        // Create a video element to handle the stream
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Update canvas size when video dimensions are known
        const updateCanvasSize = () => {
          if (video.videoWidth && video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
        };

        video.addEventListener('loadedmetadata', updateCanvasSize);

        // Draw frames to canvas
        const drawFrame = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            ctx.drawImage(video, 0, 0);
            frameCountRef.current++;
            
            // Process every 5th frame and only if enough time has passed since last detection
            const now = Date.now();
            if (frameCountRef.current % 5 === 0 && now - lastDetectionRef.current > 500) {
              processFrame();
            }
            
            animationFrameRef.current = requestAnimationFrame(drawFrame);
          }
        };

        // Start drawing frames
        drawFrame();

        return () => {
          video.removeEventListener('loadedmetadata', updateCanvasSize);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          // Stop all tracks when component unmounts
          stream.getTracks().forEach(track => track.stop());
        };
      } catch (err) {
        console.error('Error accessing RealSense camera:', err);
        setError("Failed to access camera");
        return () => {};
      }
    };

    setupStream();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const processFrame = async () => {
    if (!canvasRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      lastDetectionRef.current = Date.now();

      // Convert canvas to base64
      const imageData = canvasRef.current.toDataURL('image/jpeg').split(',')[1];

      // Send to YOLO server
      const response = await fetch('http://127.0.0.1:8000/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Detection failed');
      }

      const result = await response.json();
      setDetections(result.detections);

    } catch (error) {
      console.error('Error processing frame:', error);
      setError(error instanceof Error ? error.message : 'Failed to process frame');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon || <Video className="h-5 w-5" />} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <img
            ref={imgRef}
            className="hidden"
            onError={(e) => {
              console.error('Image error:', e);
              setError("Failed to load video stream");
            }}
            onLoad={() => setError(null)}
          />
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
          />
          {error && (
            <div className="absolute top-2 left-2 right-2 bg-red-500 text-white p-2 rounded">
              {error}
            </div>
          )}
          {detections.length > 0 && (
            <div className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded">
              <h3 className="font-bold mb-1">Detections:</h3>
              {detections.map((det, i) => (
                <div key={i}>
                  {det.class}: {Math.round(det.confidence * 100)}%
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 