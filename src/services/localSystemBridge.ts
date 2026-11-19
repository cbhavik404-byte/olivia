/**
 * localSystemBridge.ts
 * Local System Automation Bridge for NEXA / JARVIS.
 * 
 * Provides:
 * 1. Local WebSocket & HTTP Daemon Connector (default: ws://localhost:9099 or http://localhost:9099)
 * 2. Web File System Access API integration (reading/writing user-granted directories and files)
 * 3. Local Terminal / CLI Execution Bridge (spawning scripts, git commands, build scripts, npm)
 * 4. Local App Launcher & Process Management (VS Code, Terminal, Spotify, Docker, Python, etc.)
 * 5. Real-Time System Context Telemetry (CPU, Memory, Battery, Platform, Network, Directory tree)
 * 6. Built-in Simulation Fallback Engine with generated test daemon script for user download.
 */

export interface SystemTelemetry {
  os: string;
  platform: string;
  arch: string;
  hostname: string;
  uptimeSeconds: number;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePercent: number;
  memoryTotalGB: number;
  memoryUsedGB: number;
  memoryFreeGB: number;
  memoryPercent: number;
  diskFreeGB: number;
  diskTotalGB: number;
  activeProcesses: ProcessInfo[];
  connected: boolean;
  daemonVersion?: string;
  lastPing: number;
  batteryPercent?: number;
  isCharging?: boolean;
  uptimeFormatted?: string;
  networkInterfaces?: string[];
  topProcesses?: ProcessInfo[];
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number; // MB
  status: "running" | "sleeping" | "idle";
}

export interface CliCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timestamp: number;
  isSimulated: boolean;
}

export interface LocalBridgeConfig {
  wsUrl: string;
  httpUrl: string;
  authToken?: string;
  autoConnect: boolean;
  workdir: string;
}

export interface FileEntryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes?: number;
  lastModified?: number;
}

type BridgeListener = (telemetry: SystemTelemetry) => void;
type LogListener = (log: { type: "info" | "success" | "warn" | "error" | "cli"; message: string; timestamp: number }) => void;

class LocalSystemBridgeService {
  private config: LocalBridgeConfig = {
    wsUrl: "ws://localhost:9099",
    httpUrl: "http://localhost:9099",
    autoConnect: true,
    workdir: "/workspace/project",
  };

  private socket: WebSocket | null = null;
  private isConnected = false;
  private isSimulatedMode = false;
  private telemetryListeners: Set<BridgeListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }> = new Map();
  private localFileSystemHandle: any = null; // DirectoryHandle from showDirectoryPicker

  private currentTelemetry: SystemTelemetry = {
    os: "Detecting...",
    platform: typeof navigator !== "undefined" ? navigator.platform : "Unknown",
    arch: "x64",
    hostname: "bhavik-workstation",
    uptimeSeconds: 84200,
    cpuModel: "Apple Silicon / Intel Core i9 Ultra",
    cpuCores: 12,
    cpuUsagePercent: 24,
    memoryTotalGB: 32,
    memoryUsedGB: 11.4,
    memoryFreeGB: 20.6,
    memoryPercent: 35.6,
    diskFreeGB: 412,
    diskTotalGB: 1000,
    activeProcesses: [
      { pid: 1042, name: "code (VS Code)", cpu: 3.4, memory: 480, status: "running" },
      { pid: 1289, name: "node (dev server)", cpu: 1.8, memory: 310, status: "running" },
      { pid: 2490, name: "docker engine", cpu: 4.2, memory: 1240, status: "running" },
      { pid: 3102, name: "chrome", cpu: 5.6, memory: 920, status: "running" },
      { pid: 4811, name: "spotify", cpu: 0.8, memory: 190, status: "running" },
      { pid: 5120, name: "terminal (zsh)", cpu: 0.1, memory: 45, status: "running" },
    ],
    connected: false,
    daemonVersion: "1.4.0-standalone",
    lastPing: Date.now(),
  };

  constructor() {
    this.detectClientPlatform();
    this.startHeartbeatLoop();
  }

  private detectClientPlatform() {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    let osName = "Linux / POSIX";
    if (ua.includes("Win")) osName = "Windows 11 Pro";
    else if (ua.includes("Mac")) osName = "macOS Sonoma / Sequoia";
    else if (ua.includes("Android")) osName = "Android OS";
    else if (ua.includes("Linux")) osName = "Ubuntu Linux";

    this.currentTelemetry.os = osName;
    this.currentTelemetry.platform = navigator.platform;
  }

  private startHeartbeatLoop() {
    if (typeof window === "undefined") return;
    setInterval(() => {
      if (this.isConnected) {
        // Ping actual daemon
        this.sendWsMessage({ type: "ping" }).catch(() => {});
      } else {
        // Keep simulated stats lively and oscillating naturally
        this.simulateTelemetryJitter();
      }
    }, 3000);
  }

  private simulateTelemetryJitter() {
    const deltaCpu = (Math.random() - 0.5) * 6;
    const newCpu = Math.max(8, Math.min(88, Math.round(this.currentTelemetry.cpuUsagePercent + deltaCpu)));
    const deltaMem = (Math.random() - 0.5) * 0.4;
    const newMemUsed = Math.max(6, Math.min(28, +(this.currentTelemetry.memoryUsedGB + deltaMem).toFixed(1)));

    this.currentTelemetry = {
      ...this.currentTelemetry,
      cpuUsagePercent: newCpu,
      memoryUsedGB: newMemUsed,
      memoryFreeGB: +(this.currentTelemetry.memoryTotalGB - newMemUsed).toFixed(1),
      memoryPercent: Math.round((newMemUsed / this.currentTelemetry.memoryTotalGB) * 100),
      uptimeSeconds: this.currentTelemetry.uptimeSeconds + 3,
      lastPing: Date.now(),
    };

    this.notifyTelemetry();
  }

  /**
   * Connect to local host daemon (Python / Node / Go background bridge on port 9099)
   */
  public async connect(url: string = this.config.wsUrl): Promise<boolean> {
    this.config.wsUrl = url;
    this.log("info", `Initiating Local Bridge connection to ${url}...`);

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            try { ws.close(); } catch (_) {}
            this.isSimulatedMode = true;
            this.log("warn", `Local daemon unreachable at ${url}. Switching to Intelligent Local Simulation Engine & Browser Native APIs.`);
            this.currentTelemetry.connected = true; // Active via browser bridge
            this.notifyTelemetry();
            resolve(true);
          }
        }, 2200);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.socket = ws;
          this.isConnected = true;
          this.isSimulatedMode = false;
          this.currentTelemetry.connected = true;
          this.log("success", `⚡ Connected to Native Local OS Daemon on ${url}! Full hardware & CLI hooks established.`);
          this.notifyTelemetry();
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleDaemonMessage(data);
          } catch (e) {
            console.error("[LocalBridge] Bad message format:", e);
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          this.isSimulatedMode = true;
          this.currentTelemetry.connected = true;
          this.log("warn", `Local daemon unreachable at ${url}. Active on Intelligent Local Simulation & Browser Native APIs.`);
          this.notifyTelemetry();
          resolve(true);
        };

        ws.onclose = () => {
          this.isConnected = false;
          this.socket = null;
          this.currentTelemetry.connected = this.isSimulatedMode;
          this.notifyTelemetry();
        };
      } catch (err) {
        this.isSimulatedMode = true;
        this.currentTelemetry.connected = true;
        this.log("warn", `Could not initialize raw socket. Active on Web Local Bridge.`);
        resolve(true);
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.isSimulatedMode = false;
    this.currentTelemetry.connected = false;
    this.log("info", "Local System Bridge disconnected.");
    this.notifyTelemetry();
  }

  public isLiveDaemonConnected(): boolean {
    return this.isConnected && !this.isSimulatedMode;
  }

  public isSimulated(): boolean {
    return !this.isConnected || this.isSimulatedMode;
  }

  private handleDaemonMessage(msg: any) {
    if (msg.type === "telemetry" && msg.data) {
      this.currentTelemetry = {
        ...this.currentTelemetry,
        ...msg.data,
        connected: true,
        lastPing: Date.now(),
      };
      this.notifyTelemetry();
    } else if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
      const p = this.pendingRequests.get(msg.requestId)!;
      clearTimeout(p.timer);
      this.pendingRequests.delete(msg.requestId);
      if (msg.error) {
        p.reject(new Error(msg.error));
      } else {
        p.resolve(msg.data);
      }
    }
  }

  private sendWsMessage(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return reject(new Error("Socket not open"));
      }
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const message = { ...payload, requestId };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Local daemon request timeout"));
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      this.socket.send(JSON.stringify(message));
    });
  }

  /**
   * 1. Terminal / CLI Execution
   * Executes commands on the user's terminal or simulates accurately.
   */
  public async executeCommand(command: string): Promise<CliCommandResult> {
    const startTime = Date.now();
    this.log("cli", `$ ${command}`);

    if (this.isConnected && this.socket && !this.isSimulatedMode) {
      try {
        const res = await this.sendWsMessage({ type: "execute_cli", command });
        const duration = Date.now() - startTime;
        this.log("info", `[LIVE DAEMON: ${duration}ms, exit ${res.exitCode || 0}]`);
        return {
          command,
          exitCode: res.exitCode || 0,
          stdout: res.stdout || "",
          stderr: res.stderr || "",
          durationMs: duration,
          timestamp: Date.now(),
          isSimulated: false,
        };
      } catch (err: any) {
        this.log("error", `Command failed on live daemon: ${err.message}`);
      }
    }

    // Explicit Simulation Fallback when local daemon ws://localhost:9099 is not connected
    return this.simulateCliExecution(command, startTime);
  }

  private simulateCliExecution(command: string, startTime: number): Promise<CliCommandResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const cmd = command.trim();
        let stdout = "";
        let stderr = "";
        let exitCode = 0;

        if (cmd === "git status" || cmd.startsWith("git status")) {
          stdout = `[SIMULATED OUTPUT - Local daemon offline]\nOn branch main\nYour branch is up to date with 'origin/main'.\n\nnothing real checked; start nexa_bridge_daemon.py on port 9099 for live git status.`;
        } else if (cmd.startsWith("git log")) {
          stdout = `[SIMULATED OUTPUT - Local daemon offline]\nSample git history preview; connect native daemon (port 9099) for live repository history.`;
        } else if (cmd.startsWith("ls") || cmd === "dir") {
          stdout = `[SIMULATED OUTPUT]\npackage.json   src/   public/   tsconfig.json   server.ts`;
        } else if (cmd.startsWith("pwd")) {
          stdout = `[SIMULATED WORKDIR] ${this.config.workdir}`;
        } else if (cmd.startsWith("docker ps")) {
          stdout = `[SIMULATED OUTPUT - Connect native daemon for live Docker containers]`;
        } else if (cmd.startsWith("python --version") || cmd.startsWith("python3 --version")) {
          stdout = `[SIMULATED] Python 3.11.x preview (start native daemon for actual host version)`;
        } else if (cmd.startsWith("node -v") || cmd.startsWith("node --version")) {
          stdout = `[SIMULATED] Node.js preview (start native daemon for actual host version)`;
        } else {
          stdout = `[SIMULATED LOCAL BRIDGE] Mock preview for '${cmd}' — no native desktop daemon connected at ${this.config.wsUrl}. Run nexa_bridge_daemon.py for real shell execution.`;
        }

        const duration = Date.now() - startTime;
        this.log("warn", `[SIMULATED SANDBOX: ${duration}ms — start nexa_bridge_daemon.py for live OS CLI]`);
        resolve({
          command,
          exitCode,
          stdout,
          stderr,
          durationMs: duration,
          timestamp: Date.now(),
          isSimulated: true,
        });
      }, 250);
    });
  }

  /**
   * 2. Local Application Control & Task Management
   * Controls VS Code, Terminal, Spotify, Browser, Docker, or terminates heavy processes.
   */
  public async launchLocalApp(appName: string, args: string[] = []): Promise<string> {
    const target = appName.toLowerCase().trim();
    this.log("info", `Requesting OS process launch for: ${appName}`);

    if (this.isConnected && this.socket && !this.isSimulatedMode) {
      try {
        const res = await this.sendWsMessage({ type: "launch_app", appName: target, args });
        return `[LIVE DAEMON] ${res.message || `Launched native application ${appName} successfully.`}`;
      } catch (err: any) {
        console.warn("Daemon launch app err:", err);
      }
    }

    // Browser protocol handler / simulated desktop fallback
    switch (target) {
      case "vscode":
      case "code":
      case "vs code":
        if (typeof window !== "undefined") {
          window.open("vscode://", "_blank");
        }
        return "[BROWSER PROTOCOL] Dispatched vscode:// URI handler (native daemon offline).";

      case "terminal":
      case "iterm":
      case "bash":
        return `[SIMULATED] Native daemon offline — start nexa_bridge_daemon.py on port 9099 to spawn a real Terminal in ${this.config.workdir}.`;

      case "spotify":
        if (typeof window !== "undefined") {
          window.open("spotify://", "_blank");
        }
        return "[BROWSER PROTOCOL] Dispatched spotify:// URI handler (native daemon offline).";

      case "docker":
        return "[SIMULATED] Native daemon offline — cannot start Docker Desktop without local daemon connection.";

      case "chrome":
      case "browser":
        if (typeof window !== "undefined") {
          window.open("https://google.com", "_blank");
        }
        return "[BROWSER] Opened new browser tab.";

      default:
        return `[SIMULATED] App launch request for '${appName}' queued in simulation mode (native daemon offline).`;
    }
  }

  public async killProcess(nameOrPid: string | number): Promise<string> {
    this.log("warn", `Requesting process termination: ${nameOrPid}`);

    const targetStr = String(nameOrPid).toLowerCase();
    const prevCount = this.currentTelemetry.activeProcesses.length;
    this.currentTelemetry.activeProcesses = this.currentTelemetry.activeProcesses.filter(
      (p) => String(p.pid) !== targetStr && !p.name.toLowerCase().includes(targetStr)
    );

    const killed = prevCount > this.currentTelemetry.activeProcesses.length;
    this.notifyTelemetry();

    if (this.isConnected && this.socket && !this.isSimulatedMode) {
      try {
        const res = await this.sendWsMessage({ type: "kill_process", target: nameOrPid });
        return `[LIVE DAEMON] ${res?.message || `Terminated real OS process ${nameOrPid}.`}`;
      } catch (_) {}
    }

    return killed
      ? `[SIMULATED] Removed mock process ${nameOrPid} from preview table (native daemon offline — no real OS process killed).`
      : `[SIMULATED] Native daemon offline — no real OS process terminated for ${nameOrPid}.`;
  }

  /**
   * 3. Local File System Management (Native Web File System Access API)
   */
  public async pickLocalWorkspaceDirectory(): Promise<{ success: boolean; dirName: string; files: FileEntryItem[] }> {
    if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
      return {
        success: false,
        dirName: "Web File System API not supported in this browser",
        files: [],
      };
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      this.localFileSystemHandle = dirHandle;
      this.config.workdir = `/${dirHandle.name}`;

      const files: FileEntryItem[] = [];
      for await (const entry of dirHandle.values()) {
        files.push({
          name: entry.name,
          path: `/${dirHandle.name}/${entry.name}`,
          isDirectory: entry.kind === "directory",
        });
      }

      this.log("success", `Mounted local folder: ${dirHandle.name} (${files.length} items discovered).`);
      return {
        success: true,
        dirName: dirHandle.name,
        files,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        this.log("info", "Directory selection cancelled by user.");
      } else {
        this.log("error", `File system access error: ${err.message}`);
      }
      return { success: false, dirName: "", files: [] };
    }
  }

  /**
   * Write content directly into a local file (in mounted directory or via auto-download)
   */
  public async writeLocalFile(fileName: string, content: string): Promise<string> {
    this.log("info", `Writing file "${fileName}" (${content.length} chars)...`);

    if (this.localFileSystemHandle) {
      try {
        const fileHandle = await this.localFileSystemHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        this.log("success", `Directly wrote "${fileName}" to mounted local directory.`);
        return `Successfully saved "${fileName}" to your local directory.`;
      } catch (err: any) {
        console.warn("Direct FS write error, falling back to download:", err);
      }
    }

    // Seamless browser download fallback
    if (typeof window !== "undefined") {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return `Saved and downloaded "${fileName}" to your local filesystem.`;
  }

  /**
   * Generate downloadable standalone Python / Node Daemon Script
   * Users can run `python jarvis_bridge.py` on their Mac/PC/Linux to give Alexa full native OS control!
   */
  public getPythonDaemonScript(): string {
    return `#!/usr/bin/env python3
"""
NEXA / JARVIS Local System Bridge Daemon
Run this lightweight script on your PC/Mac/Linux to grant NEXA full local OS control!
Port: 9099 (WebSocket + HTTP)
"""

import asyncio
import json
import os
import platform
import psutil
import subprocess
import sys

try:
    import websockets
except ImportError:
    print("[NEXA Bridge] Installing required dependency 'websockets'...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "psutil"])
    import websockets
    import psutil

PORT = 9099
HOST = "0.0.0.0"

def get_system_telemetry():
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']):
        try:
            info = proc.info
            mem_mb = round(info['memory_info'].rss / (1024 * 1024), 1) if info['memory_info'] else 0
            processes.append({
                "pid": info['pid'],
                "name": info['name'],
                "cpu": info['cpu_percent'] or 0.0,
                "memory": mem_mb,
                "status": info['status']
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    processes.sort(key=lambda x: x['cpu'], reverse=True)

    return {
        "os": f"{platform.system()} {platform.release()}",
        "platform": platform.platform(),
        "arch": platform.machine(),
        "hostname": platform.node(),
        "cpuModel": platform.processor() or "Multi-Core CPU",
        "cpuCores": psutil.cpu_count(logical=True),
        "cpuUsagePercent": cpu_percent,
        "memoryTotalGB": round(mem.total / (1024**3), 1),
        "memoryUsedGB": round(mem.used / (1024**3), 1),
        "memoryFreeGB": round(mem.available / (1024**3), 1),
        "memoryPercent": mem.percent,
        "diskTotalGB": round(disk.total / (1024**3), 1),
        "diskFreeGB": round(disk.free / (1024**3), 1),
        "activeProcesses": processes[:12],
        "daemonVersion": "1.4.0-native-python"
    }

async def handle_client(websocket):
    print(f"[NEXA Bridge] Client connected from {websocket.remote_address}")
    
    # Send initial telemetry
    await websocket.send(json.dumps({
        "type": "telemetry",
        "data": get_system_telemetry()
    }))

    try:
        async for message in websocket:
            req = json.loads(message)
            req_type = req.get("type")
            req_id = req.get("requestId")

            if req_type == "ping":
                await websocket.send(json.dumps({
                    "type": "telemetry",
                    "data": get_system_telemetry()
                }))
            elif req_type == "execute_cli":
                cmd = req.get("command", "")
                print(f"[NEXA CLI Exec] {cmd}")
                proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                await websocket.send(json.dumps({
                    "requestId": req_id,
                    "data": {
                        "command": cmd,
                        "exitCode": proc.returncode,
                        "stdout": proc.stdout,
                        "stderr": proc.stderr
                    }
                }))
            elif req_type == "launch_app":
                app_name = req.get("appName", "")
                print(f"[NEXA Launch] {app_name}")
                if sys.platform == "darwin":
                    subprocess.Popen(["open", "-a", app_name])
                elif sys.platform == "win32":
                    subprocess.Popen(["start", app_name], shell=True)
                else:
                    subprocess.Popen([app_name], shell=True)
                await websocket.send(json.dumps({
                    "requestId": req_id,
                    "data": {"message": f"Launched {app_name} on native OS."}
                }))
            elif req_type == "kill_process":
                target = req.get("target")
                try:
                    pid = int(target)
                    p = psutil.Process(pid)
                    p.terminate()
                except ValueError:
                    for proc in psutil.process_iter(['name']):
                        if target.lower() in proc.info['name'].lower():
                            proc.terminate()
                await websocket.send(json.dumps({
                    "requestId": req_id,
                    "data": {"message": f"Terminated process {target}."}
                }))
    except websockets.exceptions.ConnectionClosed:
        print("[NEXA Bridge] Client disconnected.")

async def main():
    print("=" * 60)
    print("⚡ NEXA / JARVIS Native OS Bridge Daemon Running")
    print(f"📡 WebSocket Host: ws://localhost:{PORT}")
    print("Granting autonomous CLI, app launching & telemetry hooks.")
    print("=" * 60)
    async with websockets.serve(handle_client, HOST, PORT):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\\n[NEXA Bridge] Server stopped by user.")
`;
  }

  // Telemetry Subscriptions
  public subscribeTelemetry(listener: BridgeListener): () => void {
    this.telemetryListeners.add(listener);
    listener(this.currentTelemetry);
    return () => this.telemetryListeners.delete(listener);
  }

  private notifyTelemetry() {
    for (const listener of this.telemetryListeners) {
      listener(this.currentTelemetry);
    }
  }

  public subscribeLogs(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private log(type: "info" | "success" | "warn" | "error" | "cli", message: string) {
    const entry = { type, message, timestamp: Date.now() };
    for (const listener of this.logListeners) {
      listener(entry);
    }
  }

  public getTelemetry(): SystemTelemetry {
    return this.currentTelemetry;
  }

  public getConfig(): LocalBridgeConfig {
    return this.config;
  }
}

export const localSystemBridge = new LocalSystemBridgeService();
