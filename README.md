# Drone-Arm Teleoperation System: Project ANGEL

This project is a modified version of the [phosphobot](https://github.com/phospho-app/phosphobot) and [LeRobot](https://github.com/lerobot/lerobot) platforms, adapted for teleoperating robot arms mounted on FPV drones.



## Overview

- 🤖 Teleoperate a drone-mounted robot arm using a leader-follower setup
- 📹 Real-time depth camera feed with object detection using YOLO
- 📏 Distance measurement using depth camera data
- 🎮 Control the follower arm using the leader arm
- 💻 Runs on macOS, Linux and Windows
- 🔧 Extensible system for custom robot configurations

## Features

### Leader-Follower Arm Setup
- Master-slave configuration for precise control
- Leader arm for intuitive teleoperation
- Follower arm mounted on FPV drone for remote manipulation

### Enhanced Vision System
- Real-time depth camera feed in the dashboard
- YOLO-based object detection
- Distance measurement capabilities using depth data
- Improved situational awareness for drone operations

## Getting Started

### 1. System Requirements
- Leader arm for control
- Follower arm mounted on FPV drone
- Depth camera system
- Compatible computer system

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/drone-arm.git
cd drone-arm

# Install dependencies
pip install -r requirements.txt
```

### 3. Running the System

```bash
# Start the server
python main.py
```

Access the dashboard at `localhost:80` to:
- View the depth camera feed
- Monitor object detection results
- Check distance measurements
- Control the follower arm using the leader arm

## Advanced Usage

The system provides both HTTP and WebSocket APIs for custom integrations. API documentation is available at `YOUR_SERVER_ADDRESS:YOUR_SERVER_PORT/docs`.

## Contributing

We welcome contributions! Some ways you can contribute:
- Improve the leader-follower control system
- Enhance object detection capabilities
- Add support for different drone platforms
- Improve depth camera integration
- Add new features to the dashboard
- Improve documentation

## Support

- **Issues**: Submit problems or suggestions through [GitHub Issues](https://github.com/your-username/drone-arm/issues)

## License

MIT License

---

Built on top of [phosphobot](https://github.com/phospho-app/phosphobot) and [LeRobot](https://github.com/lerobot/lerobot)
