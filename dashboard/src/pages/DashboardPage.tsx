// @ts-ignore
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CameraStreamCard } from "@/components/common/camera-stream-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useGlobalStore } from "@/lib/hooks";
import { fetchWithBaseUrl, fetcher } from "@/lib/utils";
import type { ServerStatus, DepthMeasurement } from "@/types";
// @ts-ignore
import { AlertCircle, Play, Settings, Square, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ChartContainer } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { VideoFeed } from "@/components/VideoFeed";

// Physical limits for joints (radians)
const POSITION_LIMIT = Math.PI;
const TORQUE_LIMIT = 500;

interface RobotPair {
  leader_id: number | null;
  follower_id: number | null;
  leader_serial_id: string;
}

export default function DashboardPage() {
  const setLeaderArmSerialIds = useGlobalStore((state) => state.setLeaderArmSerialIds);
  const [invertControls, setInvertControls] = useState(false);
  const [enableGravityControl, setEnableGravityControl] = useState(false);
  const [plotOption] = useState<string>("Position");

  // State for robot pairs
  const [robotPairs, setRobotPairs] = useState<RobotPair[]>([
    { leader_id: null, follower_id: null, leader_serial_id: "" },
  ]);

  const [gravityCompensationValues, setGravityCompensationValues] = useState({
    shoulder: 100,
    elbow: 100,
    wrist: 100,
  });

  // Data for joint graphs
  const [positionBuffers, setPositionBuffers] = useState<Array<{ time: number; value: number; goal: number }>[]>(
    Array(6).fill(null).map(() => Array.from({ length: 30 }, (_, i) => ({ time: i, value: 0, goal: 0 })))
  );
  const [torqueBuffers, setTorqueBuffers] = useState<Array<{ time: number; value: number }>[]>(
    Array(6).fill(null).map(() => Array.from({ length: 30 }, (_, i) => ({ time: i, value: 0 })))
  );

  const { data: serverStatus, mutate } = useSWR<ServerStatus>(
    ["/status"],
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const connectedRobots = serverStatus?.robot_status || [];

  // Add depth measurement polling
  const { data: depthMeasurement } = useSWR<DepthMeasurement>(
    ["/depth/measurement"],
    fetcher,
    {
      refreshInterval: 100, // Poll every 100ms for smooth updates
      revalidateOnFocus: true,
    }
  );

  // Set default leader and follower when robots are connected
  useEffect(() => {
    if (connectedRobots.length >= 2 && robotPairs[0].leader_id === null && robotPairs[0].follower_id === null) {
      const initialPairs: RobotPair[] = [
        {
          leader_id: 0,
          follower_id: 1,
          leader_serial_id: connectedRobots[0].device_name || "",
        },
      ];
      setRobotPairs(initialPairs);
      setLeaderArmSerialIds([initialPairs[0].leader_serial_id]);
    } else if (connectedRobots.length === 1) {
      setRobotPairs([{ leader_id: null, follower_id: 0, leader_serial_id: "" }]);
      setLeaderArmSerialIds([]);
    } else if (connectedRobots.length === 0) {
      setRobotPairs([{ leader_id: null, follower_id: null, leader_serial_id: "" }]);
      setLeaderArmSerialIds([]);
    }
  }, [connectedRobots, setLeaderArmSerialIds]);

  // Update position and torque buffers
  useEffect(() => {
    if (!serverStatus?.robot_status) return;

    const updateBuffers = () => {
      // Update position buffers
      setPositionBuffers(prev => 
        prev.map((buf) => {
          const next = buf.slice(1);
          next.push({
            time: buf[buf.length - 1].time + 1,
            value: 0, // Replace with actual position data when available
            goal: 0,  // Replace with actual goal data when available
          });
          return next;
        })
      );

      // Update torque buffers
      setTorqueBuffers(prev =>
        prev.map((buf) => {
          const next = buf.slice(1);
          next.push({
            time: buf[buf.length - 1].time + 1,
            value: 0, // Replace with actual torque data when available
          });
          return next;
        })
      );
    };

    const interval = setInterval(updateBuffers, 1000);
    return () => clearInterval(interval);
  }, [serverStatus?.robot_status]);

  const handleMoveStart = async () => {
    const invalidPairs = robotPairs.filter(
      (pair) => pair.leader_id === null || pair.follower_id === null
    );

    if (invalidPairs.length > 0) {
      toast.error("Please select both leader and follower robots for all pairs");
      return;
    }

    await fetchWithBaseUrl(`/move/leader/start`, "POST", {
      robot_pairs: robotPairs,
      invert_controls: invertControls,
      enable_gravity_compensation: enableGravityControl,
      gravity_compensation_values: !enableGravityControl ? gravityCompensationValues : null,
    });
    mutate();
  };

  const handleMoveStop = async () => {
    await fetchWithBaseUrl(`/move/leader/stop`, "POST");
    mutate();
  };

  // Check if configuration is valid
  const isConfigValid = robotPairs.every(
    (pair) => pair.leader_id !== null && pair.follower_id !== null
  );

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="grid grid-cols-12 gap-4">
        {/* Video Feed Section */}
        <div className="col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" /> Drone Camera Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {serverStatus?.cameras.video_cameras_ids.map((cameraId) => (
                  cameraId === 1 ? (
                    <VideoFeed
                      key={cameraId}
                      title={`Camera ${cameraId}`}
                      streamPath={`/video/${cameraId}`}
                      icon={<Video className="h-4 w-4" />}
                    />
                  ) : (
                    <CameraStreamCard
                      key={cameraId}
                      id={cameraId}
                      title={`Camera ${cameraId}`}
                      streamPath={`/video/${cameraId}`}
                      alt={`Video Stream ${cameraId}`}
                      icon={<Video className="h-4 w-4" />}
                      showRecordingControls={false}
                    />
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Panel */}
        <div className="col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Gripper Status:</Label>
                  <span className="text-green-500">OPEN</span>
                </div>
                <div className="flex justify-between items-center">
                  <Label>Arm Position:</Label>
                  <span>X: 0.00 Y: 0.00 Z: 0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <Label>Battery:</Label>
                  <span>78%</span>
                </div>
                <div className="flex justify-between items-center">
                  <Label>Distance:</Label>
                  <div className="flex items-center gap-2">
                    <span>
                      {depthMeasurement ? (
                        <>
                          {(depthMeasurement.distance / 1000).toFixed(2)}m
                          <span className="text-xs text-gray-500 ml-1">
                            ({Math.round(depthMeasurement.confidence * 100)}% confidence)
                          </span>
                        </>
                      ) : (
                        "N/A"
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Joint Status Graphs */}
              <div className="space-y-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-2">Joint {i + 1}</h3>
                    <ChartContainer
                      config={
                        plotOption === "Position"
                          ? {
                              value: { label: "Position" },
                              goal: { label: "Goal", color: "red" },
                            }
                          : { value: { label: "Torque" } }
                      }
                      className="h-[180px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={plotOption === "Position" ? positionBuffers[i] : torqueBuffers[i]}
                        >
                          <YAxis
                            domain={
                              plotOption === "Position"
                                ? [-POSITION_LIMIT, POSITION_LIMIT]
                                : [-TORQUE_LIMIT, TORQUE_LIMIT]
                            }
                            tickFormatter={(value) => value.toFixed(3)}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            strokeWidth={2}
                            dot={false}
                          />
                          {plotOption === "Position" && (
                            <Line
                              type="monotone"
                              dataKey="goal"
                              strokeWidth={1}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Control Section */}
      <Card>
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Control Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Button
                onClick={handleMoveStart}
                disabled={serverStatus?.leader_follower_status || !isConfigValid || connectedRobots.length < 2}
                variant={serverStatus?.leader_follower_status ? "outline" : "default"}
                className="w-full"
              >
                {!serverStatus?.leader_follower_status && <Play className="mr-2 h-4 w-4" />}
                {serverStatus?.leader_follower_status ? "Control Running" : "Start Control"}
              </Button>
              <Button
                onClick={handleMoveStop}
                disabled={!serverStatus?.leader_follower_status}
                variant="destructive"
                className="w-full"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Control
              </Button>
            </div>

            <div className="space-y-2">
              <Button variant="outline" className="w-full">
                Manual Controls
              </Button>
              <Button variant="outline" className="w-full">
                Predefined Moves
              </Button>
            </div>

            <div className="space-y-2">
              <Button variant="outline" className="w-full">
                Zoom / Focus
              </Button>
              <Button variant="outline" className="w-full">
                Auto Track Target
              </Button>
            </div>
          </div>

          {/* Robot Pair Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leader Robot</Label>
              <Select
                value={robotPairs[0].leader_serial_id || ""}
                onValueChange={(value) => {
                  const selectedRobot = connectedRobots.find(
                    (robot) => robot.device_name === value
                  );
                  if (selectedRobot) {
                    setRobotPairs([
                      {
                        ...robotPairs[0],
                        leader_id: connectedRobots.indexOf(selectedRobot),
                        leader_serial_id: value,
                      },
                    ]);
                  }
                }}
                disabled={serverStatus?.leader_follower_status}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leader robot" />
                </SelectTrigger>
                <SelectContent>
                  {connectedRobots.map((robot, index) => (
                    <SelectItem
                      key={`leader-${index}`}
                      value={robot.device_name || "Undefined port"}
                    >
                      {robot.name} ({robot.device_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Follower Robot</Label>
              <Select
                value={
                  robotPairs[0].follower_id !== null
                    ? connectedRobots[robotPairs[0].follower_id]?.device_name || ""
                    : ""
                }
                onValueChange={(value) => {
                  const selectedRobot = connectedRobots.find(
                    (robot) => robot.device_name === value
                  );
                  if (selectedRobot) {
                    setRobotPairs([
                      {
                        ...robotPairs[0],
                        follower_id: connectedRobots.indexOf(selectedRobot),
                      },
                    ]);
                  }
                }}
                disabled={serverStatus?.leader_follower_status}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select follower robot" />
                </SelectTrigger>
                <SelectContent>
                  {connectedRobots.map((robot, index) => (
                    <SelectItem
                      key={`follower-${index}`}
                      value={robot.device_name || "Undefined port"}
                    >
                      {robot.name} ({robot.device_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Control Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <Switch
                id="invert-controls"
                checked={invertControls}
                onCheckedChange={setInvertControls}
                disabled={serverStatus?.leader_follower_status}
              />
              <Label className="text-sm font-medium">Mirror Controls</Label>
            </div>

            <div className="flex items-center space-x-3">
              <Switch
                id="toggle-gravity-control"
                checked={enableGravityControl}
                onCheckedChange={setEnableGravityControl}
                disabled={serverStatus?.leader_follower_status}
              />
              <Label className="text-sm font-medium">Gravity Control</Label>
            </div>
          </div>

          {/* Gravity Compensation Settings */}
          {enableGravityControl && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Shoulder Joint</Label>
                  <span className="text-xs">{gravityCompensationValues.shoulder}%</span>
                </div>
                <Slider
                  min={0}
                  max={200}
                  step={1}
                  value={[gravityCompensationValues.shoulder]}
                  onValueChange={(values) =>
                    setGravityCompensationValues({
                      ...gravityCompensationValues,
                      shoulder: values[0],
                    })
                  }
                  disabled={serverStatus?.leader_follower_status}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Elbow Joint</Label>
                  <span className="text-xs">{gravityCompensationValues.elbow}%</span>
                </div>
                <Slider
                  min={0}
                  max={200}
                  step={1}
                  value={[gravityCompensationValues.elbow]}
                  onValueChange={(values) =>
                    setGravityCompensationValues({
                      ...gravityCompensationValues,
                      elbow: values[0],
                    })
                  }
                  disabled={serverStatus?.leader_follower_status}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Wrist Joint</Label>
                  <span className="text-xs">{gravityCompensationValues.wrist}%</span>
                </div>
                <Slider
                  min={0}
                  max={200}
                  step={1}
                  value={[gravityCompensationValues.wrist]}
                  onValueChange={(values) =>
                    setGravityCompensationValues({
                      ...gravityCompensationValues,
                      wrist: values[0],
                    })
                  }
                  disabled={serverStatus?.leader_follower_status}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
