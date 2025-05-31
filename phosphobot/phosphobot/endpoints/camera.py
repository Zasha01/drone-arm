import base64
from typing import Dict, Optional
import cv2
import numpy as np
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse
from loguru import logger
from ultralytics import YOLO

from phosphobot.camera import AllCameras, get_all_cameras

router = APIRouter(tags=["camera"])

# Initialize YOLO model
yolo_model = YOLO('yolov8n.pt')
yolo_model.conf = 0.5
yolo_model.iou = 0.45
yolo_model.max_det = 10

def process_frame(frame: np.ndarray) -> tuple[np.ndarray, list[dict]]:
    """Process frame with YOLO detection."""
    try:
        # Run YOLO detection
        results = yolo_model(frame, verbose=False)[0]
        
        # Process detections
        detections = []
        for r in results.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = r
            class_name = results.names[int(class_id)]
            
            detections.append({
                'class': class_name,
                'confidence': float(score),
                'bbox': [float(x1), float(y1), float(x2), float(y2)]
            })
            
            # Draw bounding box and label
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
            label = f"{class_name}: {score:.2f}"
            cv2.putText(frame, label, (int(x1), int(y1) - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        return frame, detections
    except Exception as e:
        logger.error(f"Error in YOLO detection: {str(e)}")
        return frame, []

@router.get(
    "/video/{camera_id}",
    response_class=StreamingResponse,
    description="Stream video feed of the specified camera with YOLO object detection. "
    + "If no camera id is provided, the default camera is used. "
    + "If the camera id is 'realsense' or 'depth', the realsense camera is used."
    + "Specify a target size and quality using query parameters.",
    responses={
        200: {"description": "Streaming video feed of the specified camera."},
        404: {"description": "Camera not available"},
    },
)
def video_feed_for_camera(
    request: Request,
    camera_id: int | str | None,
    height: int | None = None,
    width: int | None = None,
    quality: int | None = None,
    enable_detection: bool = True,
    cameras: AllCameras = Depends(get_all_cameras),
):
    """
    Stream video feed of the specified camera with optional YOLO object detection.

    Parameters:
    - camera_id (int | str | None): ID of the camera to stream. If None, the default camera is used.
    - target_size (tuple[int, int] | None): Target size of the video feed. Default is None.
    - quality (int | None): Quality of the video feed. Default is None.
    - enable_detection (bool): Whether to enable YOLO object detection. Default is True.
    """

    if width is None or height is None:
        target_size = None
    else:
        target_size = (width, height)
    logger.debug(
        f"Received request for camera {camera_id} with target size {target_size} and quality {quality}"
    )
    if camera_id is None:
        camera_id = 0

    # Convert to integer the parameter if read as a string
    if isinstance(camera_id, str) and camera_id.isdigit():
        camera_id = int(camera_id)

    if not (isinstance(camera_id, int) or isinstance(camera_id, str)):
        raise HTTPException(
            status_code=400,
            detail=f"Unprocessable type for camera id. Received {type(camera_id)}",
        )

    if quality and (quality < 0 or quality > 100):
        raise HTTPException(
            status_code=400,
            detail=f"Quality must be between 0 and 100. Received {quality}",
        )

    stream_params = {
        "target_size": target_size,
        "quality": quality,
    }

    async def generate_frames():
        try:
            while True:
                if request.client is None:
                    break

                # Get frame from camera
                if isinstance(camera_id, int):
                    camera = cameras.get_camera_by_id(camera_id)
                    if camera is None or not camera.is_active:
                        raise HTTPException(status_code=404, detail="Camera not available")
                    frame = camera.get_rgb_frame(resize=target_size)
                else:
                    if camera_id not in ["realsense", "depth"]:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Camera {camera_id} not implemented. Use an integer or 'realsense' or 'depth'.",
                        )
                    camera = cameras.get_realsense_camera()
                    if camera is None:
                        raise HTTPException(status_code=404, detail="Camera not available")
                    frame = camera.get_rgb_frame(resize=target_size) if camera_id == "realsense" else camera.get_depth_frame(resize=target_size)

                if frame is None:
                    continue

                # Convert RGB to BGR for OpenCV
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

                # Process frame with YOLO if enabled
                if enable_detection:
                    frame, _ = process_frame(frame)

                # Convert back to RGB for streaming
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                # Encode frame
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality if quality else 80])
                frame_bytes = buffer.tobytes()

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

        except Exception as e:
            logger.error(f"Error in video stream: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get(
    "/frames",
    response_model=Dict[str, Optional[str]],
    description="Capture frames from all available cameras. "
    + "Returns a dictionary with camera IDs as keys and base64 encoded JPG images as values. "
    + "If a camera is not available or fails to capture, its value will be None.",
    responses={
        200: {
            "description": "Successfully captured frames from available cameras",
            "content": {
                "application/json": {
                    "example": {
                        "0": "base64_encoded_image_string",
                        "1": None,
                        "realsense": "base64_encoded_image_string",
                    }
                }
            },
        },
        500: {"description": "Server error while capturing frames"},
    },
)
async def get_all_camera_frames(
    cameras: AllCameras = Depends(get_all_cameras),
) -> Dict[str, Optional[str]]:
    """
    Capture and return frames from all available cameras.
    Returns:
        Dict[str, Optional[str]]: Dictionary mapping camera IDs to base64 encoded JPG images
        or None if camera is unavailable/failed to capture
    """
    logger.debug("Received request for all camera frames")

    # We can add a resize here if needed
    frames = cameras.get_rgb_frames_for_all_cameras()

    # Initialize response dictionary
    response: Dict[str, Optional[str]] = {}

    # Process each frame
    for camera_id, frame in frames.items():
        try:
            if frame is None:
                response[camera_id] = None
                continue

            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Encode frame as JPG
            _, buffer = cv2.imencode(".jpg", rgb_frame)

            # Convert to base64 string
            base64_frame = base64.b64encode(buffer.tobytes()).decode("utf-8")

            response[camera_id] = base64_frame

        except Exception as e:
            logger.error(f"Error processing frame for camera {camera_id}: {str(e)}")
            response[camera_id] = None

    if not response:
        raise HTTPException(status_code=503, detail="No camera frames available")

    return response
