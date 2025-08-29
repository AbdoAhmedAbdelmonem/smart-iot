"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthService } from "@/lib/auth"
import mqtt from "mqtt"
import {
  Thermometer,
  Wind,
  Zap,
  Wifi,
  WifiOff,
  DoorOpen,
  DoorClosed,
  Volume2,
  VolumeX,
  Settings,
  Activity,
  AlertTriangle,
  Gauge,
  RefreshCw,
  LogOut,
  Shield,
  Timer,
} from "lucide-react"
import { SlideTransition } from "@/components/ui/page-transition"
import { motion } from "framer-motion"
import { LiveSupabaseLogs } from "@/components/dashboard/live-supabase-logs"

// MQTT Configuration matching ESP32 setup
const MQTT_CONFIG = {
  server: "278db5193f6c4151a3b4fe36175cba56.s1.eu.hivemq.cloud",
  port: 8884,
  username: "Mossssssssssad",
  password: "Bolbol1212",
}

const MQTT_CONFIGS = [
  {
    name: "WSS Port 8884 with /mqtt path",
    url: `wss://${MQTT_CONFIG.server}:8884/mqtt`,
    options: {
      protocol: "wss",
      protocolVersion: 4,
      clean: true,
      rejectUnauthorized: false,
    },
  },
  {
    name: "WSS Port 8884 root path",
    url: `wss://${MQTT_CONFIG.server}:8884/`,
    options: {
      protocol: "wss",
      protocolVersion: 4,
      clean: true,
      rejectUnauthorized: false,
    },
  },
  {
    name: "WS Port 8000 (fallback)",
    url: `ws://${MQTT_CONFIG.server}:8000/mqtt`,
    options: {
      protocol: "ws",
      protocolVersion: 4,
      clean: true,
    },
  },
]

const TOPICS = {
  IR: "esp32/IR",
  HEAT: "esp32/HEAT",
  CO2: "esp32/Co2",
  SERVO: "SERVO",
  BUZZ: "BUZZ",
  TEMP_THRESHOLD: "TEMP-threshold",
  GAS_THRESHOLD: "GAS-threshold",
  FAN: "FAN",
  FAN2: "FAN2",
}

interface SensorData {
  temperature: number
  gasLevel: number
  motionDetected: boolean
  doorOpen: boolean
  servoAngle: number
  buzzerOn: boolean
  fan1On: boolean
  fan2On: boolean
  tempThreshold: number
  gasThreshold: number
  mqttConnected: boolean
  alarmActive: boolean
}

interface AdminControlRoomProps {
  onLogout: () => void
}

export function AdminControlRoom({ onLogout }: AdminControlRoomProps) {
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 24.0,
    gasLevel: 120,
    motionDetected: false,
    doorOpen: false,
    servoAngle: 0,
    buzzerOn: false,
    fan1On: false,
    fan2On: false,
    tempThreshold: 65,
    gasThreshold: 2000,
    mqttConnected: false,
    alarmActive: false,
  })

  const [simulationMode, setSimulationMode] = useState(true)
  const [mqttEnabled, setMqttEnabled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")
  const [currentConfigIndex, setCurrentConfigIndex] = useState(0)
  const [servoTimer, setServoTimer] = useState(0)
  const [tempThresholdInput, setTempThresholdInput] = useState(65)
  const [gasThresholdInput, setGasThresholdInput] = useState(2000)

  const mqttClientRef = useRef<any>(null)
  const servoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const user = AuthService.getCurrentUser()

  useEffect(() => {
    if (servoTimer > 0) {
      const interval = setInterval(() => {
        setServoTimer((prev) => {
          if (prev <= 1) {
            // Auto close servo when timer reaches 0
            setSensorData((current) => ({
              ...current,
              doorOpen: false,
              servoAngle: 0,
            }))
            // Send MQTT command to close servo
            if (mqttClientRef.current && sensorData.mqttConnected) {
              mqttClientRef.current.publish(TOPICS.SERVO, "0", { qos: 0, retain: false })
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [servoTimer, sensorData.mqttConnected])

  // Simulation effect
  useEffect(() => {
    if (!simulationMode) return

    const interval = setInterval(() => {
      setSensorData((prev) => ({
        ...prev,
        temperature: Math.max(18, Math.min(60, prev.temperature + (Math.random() - 0.5) * 0.8)),
        gasLevel: Math.max(50, Math.min(4000, prev.gasLevel + (Math.random() - 0.5) * 30)),
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [simulationMode])

  // Check for alarm conditions
  useEffect(() => {
    const tempAlarm = sensorData.temperature >= sensorData.tempThreshold
    const gasAlarm = sensorData.gasLevel >= sensorData.gasThreshold
    const alarmActive = tempAlarm || gasAlarm

    setSensorData((prev) => ({
      ...prev,
      alarmActive,
      buzzerOn: alarmActive,
      fan1On: alarmActive ? true : prev.fan1On,
      fan2On: alarmActive ? true : prev.fan2On,
    }))
  }, [sensorData.temperature, sensorData.gasLevel, sensorData.tempThreshold, sensorData.gasThreshold])

  const connectMQTT = async (configIndex = 0) => {
    if (configIndex >= MQTT_CONFIGS.length) {
      console.error("[v0] All MQTT connection attempts failed")
      setConnectionStatus("Failed - All configs tried")
      return
    }

    const config = MQTT_CONFIGS[configIndex]
    setCurrentConfigIndex(configIndex)
    setConnectionStatus(`Trying ${config.name}...`)

    try {
      const clientOptions = {
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        ...config.options,
        reconnectPeriod: 5000,
        connectTimeout: 15000,
        keepalive: 60,
        clean: true,
        clientId: `admin_dashboard_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`,
      }

      const client = mqtt.connect(config.url, clientOptions)

      const connectionTimeout = setTimeout(() => {
        if (!sensorData.mqttConnected) {
          client.end(true)
          connectMQTT(configIndex + 1)
        }
      }, 15000)

      client.on("connect", (connack) => {
        clearTimeout(connectionTimeout)
        console.log(`[v0] MQTT Connected successfully with ${config.name}!`)

        setSensorData((prev) => ({ ...prev, mqttConnected: true }))
        setConnectionStatus("Connected")
        setSimulationMode(false)

        const topicsToSubscribe = [TOPICS.HEAT, TOPICS.CO2, TOPICS.IR]
        client.subscribe(topicsToSubscribe, { qos: 0 })
      })

      client.on("message", (topic, message) => {
        console.log(`[v0] MQTT Message received - Topic: ${topic}, Message: ${message.toString()}`)

        try {
          const messageStr = message.toString()
          let value: number

          // Try to parse as JSON first (Arduino sends JSON format)
          try {
            const jsonData = JSON.parse(messageStr)
            value = Number.parseFloat(jsonData.value)
          } catch {
            // Fallback to plain number if not JSON
            value = Number.parseFloat(messageStr)
          }

          const validValue = Number.isNaN(value) ? 0 : value
          console.log(`[v0] Parsed value: ${validValue} from topic: ${topic}`)

          setSensorData((prev) => {
            switch (topic) {
              case TOPICS.HEAT:
                console.log(`[v0] Setting temperature to: ${validValue}`)
                return { ...prev, temperature: validValue }
              case TOPICS.CO2:
                console.log(`[v0] Setting gas level to: ${validValue}`)
                return { ...prev, gasLevel: validValue }
              case TOPICS.IR:
                console.log(`[v0] IR sensor value: ${validValue}`)
                if (validValue === 0) {
                  // Arduino sends 0 when motion detected (inverted logic)
                  setTimeout(() => {
                    setSensorData((p) => ({ ...p, motionDetected: false, doorOpen: false, servoAngle: 0 }))
                  }, 5000)
                  return { ...prev, motionDetected: true, doorOpen: true, servoAngle: 90 }
                }
                return prev
              default:
                return prev
            }
          })
        } catch (error) {
          console.error(`[v0] Error parsing MQTT message:`, error)
        }
      })

      client.on("error", (err) => {
        clearTimeout(connectionTimeout)
        console.error(`[v0] MQTT Connection Error with ${config.name}:`, err)
        setSensorData((prev) => ({ ...prev, mqttConnected: false }))
        setConnectionStatus(`Error: ${err.message || err.code || "Connection failed"}`)
        setTimeout(() => {
          connectMQTT(configIndex + 1)
        }, 2000)
      })

      client.on("close", () => {
        setSensorData((prev) => ({ ...prev, mqttConnected: false }))
        setConnectionStatus("Disconnected")
      })

      mqttClientRef.current = client
    } catch (error) {
      console.error(`[v0] Failed to create MQTT client with ${config.name}:`, error)
      setConnectionStatus(`Error: ${error.message}`)
      setTimeout(() => {
        connectMQTT(configIndex + 1)
      }, 1000)
    }
  }

  useEffect(() => {
    if (!mqttEnabled) {
      if (mqttClientRef.current) {
        mqttClientRef.current.end()
        mqttClientRef.current = null
        setSensorData((prev) => ({ ...prev, mqttConnected: false }))
        setConnectionStatus("Disconnected")
      }
      return
    }

    setConnectionStatus("Connecting...")
    connectMQTT(0)

    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end()
      }
    }
  }, [mqttEnabled])

  useEffect(() => {
    setMqttEnabled(true)
  }, [])

  const handleManualReconnect = () => {
    if (mqttClientRef.current) {
      mqttClientRef.current.end()
      mqttClientRef.current = null
    }
    setSensorData((prev) => ({ ...prev, mqttConnected: false }))
    setConnectionStatus("Reconnecting...")
    setTimeout(() => {
      connectMQTT(0)
    }, 1000)
  }

  const handleServoControl = () => {
    const newState = !sensorData.doorOpen
    setSensorData((prev) => ({
      ...prev,
      doorOpen: newState,
      servoAngle: newState ? 90 : 0,
    }))

    // Start 2-second timer if opening
    if (newState) {
      setServoTimer(2)
    }

    if (mqttClientRef.current && sensorData.mqttConnected) {
      const servoAngle = newState ? 90 : 0
      console.log(`[v0] Publishing servo command: ${servoAngle} to topic: ${TOPICS.SERVO}`)
      mqttClientRef.current.publish(TOPICS.SERVO, servoAngle.toString(), { qos: 0, retain: false })
    }
  }

  const handleFanControl = (fanNumber: 1 | 2, state: boolean) => {
    setSensorData((prev) => ({
      ...prev,
      [`fan${fanNumber}On`]: state,
    }))

    if (mqttClientRef.current && sensorData.mqttConnected) {
      const topic = fanNumber === 1 ? TOPICS.FAN : TOPICS.FAN2
      const command = state ? "1" : "0"
      console.log(`[v0] Publishing fan${fanNumber} command: ${command} to topic: ${topic}`)
      mqttClientRef.current.publish(topic, command, { qos: 0, retain: false })
    }
  }

  const handleApplyTempThreshold = () => {
    const validThreshold = Number.isNaN(tempThresholdInput) ? 65 : Math.max(20, Math.min(80, tempThresholdInput))
    setTempThresholdInput(validThreshold)

    setSensorData((prev) => ({
      ...prev,
      tempThreshold: validThreshold,
    }))

    if (mqttClientRef.current && sensorData.mqttConnected) {
      console.log(`[v0] Publishing temp threshold: ${validThreshold} to topic: ${TOPICS.TEMP_THRESHOLD}`)
      mqttClientRef.current.publish(TOPICS.TEMP_THRESHOLD, validThreshold.toString(), { qos: 0, retain: false })
    }
  }

  const handleApplyGasThreshold = () => {
    const validThreshold = Number.isNaN(gasThresholdInput) ? 2000 : Math.max(100, Math.min(4000, gasThresholdInput))
    setGasThresholdInput(validThreshold)

    setSensorData((prev) => ({
      ...prev,
      gasThreshold: validThreshold,
    }))

    if (mqttClientRef.current && sensorData.mqttConnected) {
      console.log(`[v0] Publishing gas threshold: ${validThreshold} to topic: ${TOPICS.GAS_THRESHOLD}`)
      mqttClientRef.current.publish(TOPICS.GAS_THRESHOLD, validThreshold.toString(), { qos: 0, retain: false })
    }
  }

  const handleBuzzerControl = (on: boolean) => {
    setSensorData((prev) => ({
      ...prev,
      buzzerOn: on,
    }))

    if (mqttClientRef.current && sensorData.mqttConnected) {
      const command = on ? "1" : "0"
      console.log(`[v0] Publishing buzzer command: ${command} to topic: ${TOPICS.BUZZ}`)
      mqttClientRef.current.publish(TOPICS.BUZZ, command, { qos: 0, retain: false })
    }
  }

  const triggerMotion = () => {
    setSensorData((prev) => ({
      ...prev,
      motionDetected: true,
      doorOpen: true,
      servoAngle: 90,
    }))
    setServoTimer(2)
  }

  const getTemperatureColor = () => {
    if (sensorData.temperature >= sensorData.tempThreshold) return "text-destructive"
    if (sensorData.temperature > 35) return "text-secondary"
    return "text-chart-3"
  }

  const getGasColor = () => {
    if (sensorData.gasLevel >= sensorData.gasThreshold) return "text-destructive"
    if (sensorData.gasLevel > 1000) return "text-secondary"
    return "text-chart-3"
  }

  return (
    <SlideTransition direction="left">
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <motion.div
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Admin Control Room
              </h1>
              <p className="text-muted-foreground mt-2">Full system control and monitoring</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{user?.email}</span>
                <Badge variant="default">Admin</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={mqttEnabled} onCheckedChange={setMqttEnabled} />
                <div className="flex items-center gap-1">
                  {sensorData.mqttConnected ? (
                    <Wifi className="h-4 w-4 text-chart-3" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Label className="text-sm">MQTT</Label>
                </div>
              </div>
              <Button variant="outline" onClick={onLogout} className="gap-2 bg-transparent">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </motion.div>

          {mqttEnabled && !sensorData.mqttConnected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Card className="border-secondary/50 bg-secondary/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-secondary border-t-transparent"></div>
                      <span className="text-secondary font-medium">{connectionStatus}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleManualReconnect}
                      className="gap-2 bg-transparent"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Alert Banner */}
          {sensorData.alarmActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Card className="border-destructive bg-destructive/10 animate-pulse-glow">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
                    <span className="font-semibold text-destructive">
                      ALERT: {sensorData.temperature >= sensorData.tempThreshold && "High Temperature"}
                      {sensorData.temperature >= sensorData.tempThreshold &&
                        sensorData.gasLevel >= sensorData.gasThreshold &&
                        " & "}
                      {sensorData.gasLevel >= sensorData.gasThreshold && "High Gas Level"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sensorData.buzzerOn ? (
                      <Volume2 className="h-5 w-5 text-destructive animate-pulse" />
                    ) : (
                      <VolumeX className="h-5 w-5 text-muted-foreground" />
                    )}
                    <Button
                      size="sm"
                      variant={sensorData.buzzerOn ? "destructive" : "outline"}
                      onClick={() => handleBuzzerControl(!sensorData.buzzerOn)}
                    >
                      {sensorData.buzzerOn ? "Stop Buzzer" : "Test Buzzer"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Control Grid */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="xl:col-span-2"
            >
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Device Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Servo Control */}
                    <div className="flex flex-col items-center space-y-4">
                      <div className="relative">
                        <motion.div
                          className={`w-32 h-32 rounded-2xl border-4 transition-all duration-500 ${
                            sensorData.doorOpen
                              ? "border-primary bg-primary/20 animate-pulse-glow"
                              : "border-muted bg-card"
                          }`}
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <div className="flex items-center justify-center h-full">
                            {sensorData.doorOpen ? (
                              <DoorOpen className="h-16 w-16 text-primary" />
                            ) : (
                              <DoorClosed className="h-16 w-16 text-muted-foreground" />
                            )}
                          </div>
                        </motion.div>
                        {servoTimer > 0 && (
                          <motion.div
                            className="absolute -top-8 left-1/2 transform -translate-x-1/2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                          >
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {Number.isNaN(servoTimer) ? "0" : servoTimer}s
                            </Badge>
                          </motion.div>
                        )}
                      </div>

                      <div className="text-center space-y-2">
                        <p className="text-sm text-muted-foreground">Door: {sensorData.doorOpen ? "Open" : "Closed"}</p>
                        <p className="text-xs text-muted-foreground">
                          Servo: {/* Add fallback for NaN servo angle */}
                          {Number.isNaN(sensorData.servoAngle) ? "0" : sensorData.servoAngle}°
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleServoControl}
                          className="bg-primary hover:bg-primary/80 shadow-lg"
                        >
                          {sensorData.doorOpen ? "Close Door" : "Open Door"}
                        </Button>
                      </div>
                    </div>

                    {/* Fan Controls */}
                    <div className="flex flex-col items-center space-y-4">
                      <div className="relative">
                        <motion.div
                          className="w-32 h-32 rounded-full border-4 flex items-center justify-center border-primary bg-primary/10"
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <Wind className="h-16 w-16 text-primary" />
                        </motion.div>
                      </div>

                      <div className="w-full space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Fan 1</Label>
                          <Switch
                            checked={sensorData.fan1On}
                            onCheckedChange={(checked) => handleFanControl(1, checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Fan 2</Label>
                          <Switch
                            checked={sensorData.fan2On}
                            onCheckedChange={(checked) => handleFanControl(2, checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* System Status */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      label: "MQTT",
                      value: sensorData.mqttConnected ? "Connected" : "Offline",
                      variant: sensorData.mqttConnected ? "default" : "secondary",
                    },
                    {
                      label: "Simulation",
                      value: simulationMode ? "Active" : "Disabled",
                      variant: simulationMode ? "default" : "secondary",
                    },
                    {
                      label: "Alarm",
                      value: sensorData.alarmActive ? "ACTIVE" : "Normal",
                      variant: sensorData.alarmActive ? "destructive" : "default",
                    },
                    {
                      label: "Fan 1",
                      value: sensorData.fan1On ? "ON" : "OFF",
                      variant: sensorData.fan1On ? "default" : "secondary",
                    },
                    {
                      label: "Fan 2",
                      value: sensorData.fan2On ? "ON" : "OFF",
                      variant: sensorData.fan2On ? "default" : "secondary",
                    },
                  ].map((status, index) => (
                    <motion.div
                      key={status.label}
                      className="flex items-center justify-between"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                    >
                      <span className="text-sm text-muted-foreground">{status.label}</span>
                      <Badge variant={status.variant as any}>{status.value}</Badge>
                    </motion.div>
                  ))}

                  <div className="pt-4 border-t border-border">
                    <div
                      className={`text-xs font-medium ${sensorData.mqttConnected ? "text-green-500" : "text-red-500"}`}
                    >
                      Status: {connectionStatus}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Temperature Control */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Thermometer className={`h-5 w-5 ${getTemperatureColor()}`} />
                    Temperature Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getTemperatureColor()}`}>
                      {Number.isNaN(sensorData.temperature) ? "0.0" : sensorData.temperature.toFixed(1)}°C
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Current: {Number.isNaN(sensorData.tempThreshold) ? "65" : sensorData.tempThreshold}°C
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm">Temperature Threshold</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={Number.isNaN(tempThresholdInput) ? "" : tempThresholdInput}
                        onChange={(e) => {
                          const val = Number.parseFloat(e.target.value)
                          setTempThresholdInput(Number.isNaN(val) ? 65 : val)
                        }}
                        min={20}
                        max={80}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={handleApplyTempThreshold} className="bg-primary hover:bg-primary/80">
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Gas Control */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className={`h-5 w-5 ${getGasColor()}`} />
                    Gas Level Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getGasColor()}`}>
                      {Number.isNaN(sensorData.gasLevel) ? "0" : Math.round(sensorData.gasLevel)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ppm (Current: {Number.isNaN(sensorData.gasThreshold) ? "2000" : sensorData.gasThreshold})
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm">Gas Threshold</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={Number.isNaN(gasThresholdInput) ? "" : gasThresholdInput}
                        onChange={(e) => {
                          const val = Number.parseFloat(e.target.value)
                          setGasThresholdInput(Number.isNaN(val) ? 2000 : val)
                        }}
                        min={100}
                        max={4000}
                        step={50}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={handleApplyGasThreshold} className="bg-primary hover:bg-primary/80">
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* MQTT Configuration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    MQTT Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Broker</Label>
                    <Input value={MQTT_CONFIG.server} readOnly className="text-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-sm">Port</Label>
                      <Input value={MQTT_CONFIG.port} readOnly className="text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">User</Label>
                      <Input value={MQTT_CONFIG.username} readOnly className="text-xs" />
                    </div>
                  </div>

                  <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                    <div>Subscribe Topics:</div>
                    <div className="font-mono">• {TOPICS.HEAT} (sensor data)</div>
                    <div className="font-mono">• {TOPICS.CO2} (sensor data)</div>
                    <div className="font-mono">• {TOPICS.IR} (sensor data)</div>
                    <div className="mt-2">Publish Topics:</div>
                    <div className="font-mono">• {TOPICS.SERVO} (control)</div>
                    <div className="font-mono">• {TOPICS.BUZZ} (control)</div>
                    <div className="font-mono">• {TOPICS.FAN} (control)</div>
                    <div className="font-mono">• {TOPICS.FAN2} (control)</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Live Supabase Logs section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <LiveSupabaseLogs maxEntries={50} className="glass-effect border-primary/20" />
          </motion.div>
        </div>
      </div>
    </SlideTransition>
  )
}
