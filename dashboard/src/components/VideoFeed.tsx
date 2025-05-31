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

  useEffect(() => {
    // Set up detection interval
    const interval = setInterval(processFrame, 100); // Process every 100ms

    return () => {
      clearInterval(interval);
    };
  }, []);

  const processFrame = async () => {
    if (!imgRef.current || !canvasRef.current || isProcessing || error) return;

    try {
      setIsProcessing(true);

      // Draw current frame to canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match image dimensions
      if (imgRef.current.naturalWidth && imgRef.current.naturalHeight) {
        canvas.width = imgRef.current.naturalWidth;
        canvas.height = imgRef.current.naturalHeight;
        ctx.drawImage(imgRef.current, 0, 0);
      } else {
        return; // Skip if image dimensions aren't ready
      }

      // Convert canvas to base64
      const imageData = canvas.toDataURL('image/jpeg').split(',')[1];

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
      
      // Update canvas with processed image
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = `data:image/jpeg;base64,${result.processed_image}`;

      // Update detections state
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
            src={`${streamPath}?enable_detection=true`}
            className="w-full rounded-lg"
            onError={(e) => {
              console.error('Image error:', e);
              setError("Failed to load video stream");
            }}
            onLoad={() => setError(null)}
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