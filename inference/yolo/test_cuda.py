import torch
import time

def test_cuda():
    print("PyTorch version:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    
    if torch.cuda.is_available():
        print("CUDA version:", torch.version.cuda)
        print("GPU Device:", torch.cuda.get_device_name(0))
        print("Number of GPUs:", torch.cuda.device_count())
        
        # Test GPU computation
        print("\nTesting GPU computation...")
        
        # Create large tensors
        size = 1000
        a = torch.randn(size, size, device='cuda')
        b = torch.randn(size, size, device='cuda')
        
        # Time matrix multiplication
        start_time = time.time()
        c = torch.matmul(a, b)
        torch.cuda.synchronize()  # Wait for GPU to finish
        end_time = time.time()
        
        print(f"Matrix multiplication time: {(end_time - start_time)*1000:.2f} ms")
        
        # Test memory
        print("\nGPU Memory Info:")
        print(f"Allocated: {torch.cuda.memory_allocated(0)/1024**2:.2f} MB")
        print(f"Cached: {torch.cuda.memory_reserved(0)/1024**2:.2f} MB")
        
        # Test YOLO model loading
        print("\nTesting YOLO model loading...")
        try:
            from ultralytics import YOLO
            model = YOLO('yolov8n.pt')
            model.to('cuda')
            print("Successfully loaded YOLO model on GPU")
        except Exception as e:
            print(f"Error loading YOLO model: {str(e)}")
    else:
        print("CUDA is not available. Please check your PyTorch installation.")

if __name__ == "__main__":
    test_cuda() 