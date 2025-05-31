from ultralytics import YOLO
import numpy as np
import cv2
from typing import List, Tuple, Dict, Any
import torch

class YOLODetector:
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.5):
        """Initialize YOLO detector with specified model and confidence threshold."""
        # Check if CUDA is available
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"Using device: {self.device}")
        if self.device == 'cuda':
            print(f"GPU: {torch.cuda.get_device_name(0)}")
        
        # Load model
        self.model = YOLO(model_path)
        
        # Basic configuration
        self.model.conf = conf_threshold
        self.model.iou = 0.45
        self.model.max_det = 10
        
        # Force CPU for NMS
        self.model.overrides = {
            'device': 'cpu',
            'conf': conf_threshold,
            'iou': 0.45,
            'max_det': 10
        }

    def detect(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Perform object detection on the input frame.
        
        Args:
            frame: Input image as numpy array (BGR format)
            
        Returns:
            Tuple containing:
            - Processed frame with detection overlays
            - List of detections with class names, confidence scores, and bounding boxes
        """
        try:
            # Run YOLO detection
            results = self.model(frame, verbose=False)[0]
            
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
            print(f"Error in detection: {str(e)}")
            # Return original frame and empty detections list on error
            return frame, [] 