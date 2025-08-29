"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AuthService } from "@/lib/auth"
import mqtt from "mqtt"
import { Thermometer, Gauge, Activity, AlertTriangle, LogOut, Shield, Wifi, WifiOff } from "lucide-react"
import { PageTransition } from "@/components/ui/page-transition"
import { motion } from "framer-motion"
import { LiveSupabaseLogs } from "@/components/dashboard/live-supabase-logs"

const MQTT_CONFIG = {
  server: "278db5193f6c4151a3b4fe36175cba56.s1.eu.hivemq.cloud",
  port: 8884,
  username: "Mossssssssssad",
  password: "Bolbol1212",
}

const MQTT_CONFIGS = [
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
}

interface SensorData {
  temperature: number
  gasLevel: number
  motionDetected: boolean
  tempThreshold: number
  gasThreshold: number
  mqttConnected: boolean
  alarmActive: boolean
}

interface UserDashboardProps {
  onLogout: () => void
}

export function UserDashboard({ onLogout }: UserDashboardProps) {
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 0,
    gasLevel: 0,
    motionDetected: false,
    tempThreshold: 65,
    gasThreshold: 2000,
    mqttConnected: false,
    alarmActive: false,
  })

  const [connectionStatus, setConnectionStatus] = useState("Connecting...")
  const [currentConfigIndex, setCurrentConfigIndex] = useState(0)

  const mqttClientRef = useRef<any>(null)
  const user = AuthService.getCurrentUser()

  const connectMQTT = async (configIndex = 0) => {
    if (configIndex >= MQTT_CONFIGS.length) {
      console.error("[v0] User Dashboard - All MQTT connection attempts failed")
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
        connectTimeout: 8000,
        keepalive: 60,
        clean: true,
        clientId: `user_dashboard_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`,
      }

      const client = mqtt.connect(config.url, clientOptions)

      const connectionTimeout = setTimeout(() => {
        if (!sensorData.mqttConnected) {
          console.log(`[v0] User Dashboard - Connection timeout for ${config.name}, trying next config...`)
          client.end(true)
          connectMQTT(configIndex + 1)
        }
      }, 8000)

      client.on("connect", (connack) => {
        clearTimeout(connectionTimeout)
        console.log(`[v0] User Dashboard - MQTT Connected successfully with ${config.name}!`)

        setSensorData((prev) => ({ ...prev, mqttConnected: true }))
        setConnectionStatus("Connected")

        const topicsToSubscribe = [TOPICS.HEAT, TOPICS.CO2, TOPICS.IR]
        client.subscribe(topicsToSubscribe, { qos: 0 })
      })

      client.on("message", (topic, message) => {
        console.log(`[v0] User Dashboard - MQTT Message received - Topic: ${topic}, Message: ${message.toString()}`)

        try {
          const messageStr = message.toString()
          let value: number

          try {
            const jsonData = JSON.parse(messageStr)
            value = Number.parseFloat(jsonData.value)
          } catch {
            value = Number.parseFloat(messageStr)
          }

          const validValue = Number.isNaN(value) ? 0 : value
          console.log(`[v0] User Dashboard - Parsed value: ${validValue} from topic: ${topic}`)

          setSensorData((prev) => {
            switch (topic) {
              case TOPICS.HEAT:
                console.log(`[v0] User Dashboard - Setting temperature to: ${validValue}`)
                return { ...prev, temperature: validValue }
              case TOPICS.CO2:
                console.log(`[v0] User Dashboard - Setting gas level to: ${validValue}`)
                return { ...prev, gasLevel: validValue }
              case TOPICS.IR:
                console.log(`[v0] User Dashboard - IR sensor value: ${validValue}`)
                return { ...prev, motionDetected: validValue === 1 }
              default:
                return prev
            }
          })
        } catch (error) {
          console.error(`[v0] User Dashboard - Error parsing MQTT message:`, error)
        }
      })

      client.on("error", (err) => {
        clearTimeout(connectionTimeout)
        if (!sensorData.mqttConnected) {
          console.log(`[v0] User Dashboard - MQTT Connection failed with ${config.name}, trying next...`)
          setSensorData((prev) => ({ ...prev, mqttConnected: false }))
          setTimeout(() => {
            connectMQTT(configIndex + 1)
          }, 1000)
        }
      })

      client.on("close", () => {
        if (sensorData.mqttConnected) {
          setSensorData((prev) => ({ ...prev, mqttConnected: false }))
          setConnectionStatus("Disconnected - Reconnecting...")
          setTimeout(() => {
            connectMQTT(0)
          }, 3000)
        }
      })

      mqttClientRef.current = client
    } catch (error) {
      console.error(`[v0] User Dashboard - Failed to create MQTT client with ${config.name}:`, error)
      setTimeout(() => {
        connectMQTT(configIndex + 1)
      }, 1000)
    }
  }

  useEffect(() => {
    setConnectionStatus("Connecting...")
    connectMQTT(0)

    return () => {
      if (mqttClientRef.current) {
        console.log("[v0] User Dashboard - Cleaning up MQTT connection")
        mqttClientRef.current.end()
        mqttClientRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const tempAlarm = !isNaN(sensorData.temperature) && sensorData.temperature >= sensorData.tempThreshold
    const gasAlarm = !isNaN(sensorData.gasLevel) && sensorData.gasLevel >= sensorData.gasThreshold
    const alarmActive = tempAlarm || gasAlarm

    setSensorData((prev) => ({
      ...prev,
      alarmActive,
    }))
  }, [sensorData.temperature, sensorData.gasLevel, sensorData.tempThreshold, sensorData.gasThreshold])

  const getTemperatureColor = () => {
    if (isNaN(sensorData.temperature)) return "text-muted-foreground"
    if (sensorData.temperature >= sensorData.tempThreshold) return "text-destructive"
    if (sensorData.temperature > 35) return "text-secondary"
    return "text-chart-3"
  }

  const getGasColor = () => {
    if (isNaN(sensorData.gasLevel)) return "text-muted-foreground"
    if (sensorData.gasLevel >= sensorData.gasThreshold) return "text-destructive"
    if (sensorData.gasLevel > 1000) return "text-secondary"
    return "text-chart-3"
  }

  const displayTemperature = () => {
    return isNaN(sensorData.temperature) ? "--" : sensorData.temperature.toFixed(1)
  }

  const displayGasLevel = () => {
    return isNaN(sensorData.gasLevel) ? "--" : Math.round(sensorData.gasLevel).toString()
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <motion.div
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                IoT Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">Real-time sensor monitoring</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                {sensorData.mqttConnected ? (
                  <Wifi className="h-4 w-4 text-chart-5" />
                ) : (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Badge variant={sensorData.mqttConnected ? "default" : "secondary"}>
                  {sensorData.mqttConnected ? "Connected" : connectionStatus}
                </Badge>
              </div>
                <Button
                variant="outline"
                onClick={onLogout}
                className="gap-2 bg-transparent hover:text-white hover:border-white cursor-pointer"
                >
                <LogOut className="h-4 w-4" />
                Logout
                </Button>
            </div>
          </motion.div>

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
                      ALERT:{" "}
                      {!isNaN(sensorData.temperature) &&
                        sensorData.temperature >= sensorData.tempThreshold &&
                        "High Temperature"}
                      {!isNaN(sensorData.temperature) &&
                        sensorData.temperature >= sensorData.tempThreshold &&
                        !isNaN(sensorData.gasLevel) &&
                        sensorData.gasLevel >= sensorData.gasThreshold &&
                        " & "}
                      {!isNaN(sensorData.gasLevel) &&
                        sensorData.gasLevel >= sensorData.gasThreshold &&
                        "High Gas Level"}
                    </span>
                  </div>
                  <Badge variant="destructive">ACTIVE</Badge>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Temperature",
                icon: Thermometer,
                value: `${displayTemperature()}°C`,
                threshold: `Threshold: ${sensorData.tempThreshold}°C`,
                color: getTemperatureColor(),
                delay: 0.1,
              },
              {
                title: "Gas Level",
                icon: Gauge,
                value: displayGasLevel(),
                threshold: `ppm (Threshold: ${sensorData.gasThreshold})`,
                color: getGasColor(),
                delay: 0.2,
              },
              {
                title: "Motion Detection",
                icon: Activity,
                value: sensorData.motionDetected ? "NO MOTION" : "DETECTED",
                threshold: "",
                color: sensorData.motionDetected ? "text-secondary" : "text-muted-foreground",
                delay: 0.3,
              },
            ].map((sensor, index) => (
              <motion.div
                key={sensor.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sensor.delay, duration: 0.6 }}
              >
                <Card className="glass-effect border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <sensor.icon className={`h-5 w-5 ${sensor.color}`} />
                      {sensor.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${sensor.color}`}>{sensor.value}</div>
                      {sensor.threshold && <div className="text-sm text-muted-foreground">{sensor.threshold}</div>}
                      {sensor.title === "Motion Detection" && (
                        <Badge variant={sensorData.motionDetected ? "default" : "secondary"} className="mt-2">
                          {sensorData.motionDetected ? "Active" : "Idle"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: "MQTT Status",
                      value: sensorData.mqttConnected ? "Connected" : "Offline",
                      variant: sensorData.mqttConnected ? "default" : "secondary",
                    },
                    {
                      label: "Alarm Status",
                      value: sensorData.alarmActive ? "ACTIVE" : "Normal",
                      variant: sensorData.alarmActive ? "destructive" : "default",
                    },
                    {
                      label: "Temperature",
                      value: sensorData.temperature >= sensorData.tempThreshold ? "HIGH" : "Normal",
                      variant: sensorData.temperature >= sensorData.tempThreshold ? "destructive" : "default",
                    },
                    {
                      label: "Gas Level",
                      value: sensorData.gasLevel >= sensorData.gasThreshold ? "HIGH" : "Normal",
                      variant: sensorData.gasLevel >= sensorData.gasThreshold ? "destructive" : "default",
                    },
                  ].map((status, index) => (
                    <motion.div
                      key={status.label}
                      className="text-center"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                    >
                      <div className="text-sm text-muted-foreground">{status.label}</div>
                      <Badge variant={status.variant as any}>{status.value}</Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }}>
            <Card className="border-secondary/50 bg-secondary/10">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  <strong>User Dashboard</strong> - For device control and advanced settings, admin access is required.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}>
            <LiveSupabaseLogs maxEntries={30} className="glass-effect border-primary/20" />
          </motion.div>
        </div>
      </div>
    </PageTransition>
  )
}
