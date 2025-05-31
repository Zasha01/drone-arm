from ultralytics import YOLO
import cv2
import numpy as np

def test_yolo():
    print("Testing YOLO model...")
    
    # Load model
    model = YOLO('yolov8n.pt')
    
    # Create a test image (black image with white rectangle)
    img = np.zeros((640, 640, 3), dtype=np.uint8)
    cv2.rectangle(img, (100, 100), (300, 300), (255, 255, 255), -1)
    
    # Save test image
    cv2.imwrite('test_image.jpg', img)
    
    # Run inference
    print("Running inference...")
    results = model(img, verbose=True)
    
    # Print results
    print("\nResults:")
    for r in results:
        print(f"Number of detections: {len(r.boxes)}")
        for box in r.boxes:
            print(f"Class: {r.names[int(box.cls)]}, Confidence: {box.conf:.2f}")

if __name__ == "__main__":
    test_yolo() 