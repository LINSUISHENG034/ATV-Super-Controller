# 产品需求文档 (PRD): ATV-Scheduler-CLI

| 版本 | 日期 | 作者 | 状态 |
| --- | --- | --- | --- |
| v1.0 | 2026-01-29 | Gemini | 规划中 |

## 1. 项目背景与目标

### 1.1 背景

用户拥有局域网内的 Android TV 设备，需要通过终端（Terminal）对其进行自动化控制。目前的痛点是每次操作都需要手动输入 ADB 指令，缺乏自动化的定时触发机制。

### 1.2 目标

开发一个基于 **Node.js** 的命令行工具，能够：

1. 通过局域网 (ADB over TCP) 连接 Android TV。
2. **核心场景**：在指定时间自动唤醒电视并播放指定的 YouTube 频道/视频。
3. **泛化能力**：支持通过配置文件（JSON/YAML）定义不同的定时任务（Cron）和执行动作（Shell/Intent），不仅限于 YouTube。

---

## 2. 用户故事 (User Stories)

| ID | 角色 | 功能描述 | 验收标准 |
| --- | --- | --- | --- |
| US-01 | 用户 | 配置设备连接信息 | 能够通过配置文件指定 TV 的 IP 地址和端口，且工具能自动重连。 |
| US-02 | 用户 | **定时播放 YouTube** | 设定每天 08:00，电视自动唤醒，且 YouTube 应用打开并开始播放特定频道。 |
| US-03 | 用户 | 自定义任意命令 | 能够配置一个任务，在每天 23:00 执行“强制休眠”命令。 |
| US-04 | 用户 | 查看任务状态 | 在终端运行命令，能看到当前挂起的定时任务列表。 |

---

## 3. 功能需求 (Functional Requirements)

### 3.1 核心模块：任务调度器 (Scheduler)

* **输入**：读取根目录下的 `tasks.config.json` (或 `.js`) 文件。
* **逻辑**：集成 `node-schedule` 或 `node-cron` 库，解析 Cron 表达式。
* **泛化设计**：任务结构不应硬编码，应支持“动作类型”的抽象。

### 3.2 核心模块：ADB 控制器 (ADB Client)

* 基于 `adb-kit` (Node.js 库) 实现。
* **功能封装**：
* `connect()`: 建立 TCP 连接。
* `wakeUp()`: 发送 `KEYCODE_WAKEUP` 或 `KEYCODE_POWER`。
* `startIntent(url)`: 封装 `am start` 命令，用于启动应用。
* `execShell(cmd)`: 执行任意 ADB Shell 指令。



### 3.3 配置文件设计 (泛化实现的关键)

为了满足“功能泛化”，配置结构设计如下：

```json
// tasks.config.json 示例
{
  "device": {
    "ip": "192.168.1.100",
    "port": 5555
  },
  "tasks": [
    {
      "name": "Morning News",
      "cron": "0 30 7 * * *",  // 每天 7:30
      "actions": [
        { "type": "wake_up" },
        { "type": "wait", "ms": 5000 }, // 等待联网和启动
        { 
          "type": "launch_app", 
          "package": "com.google.android.youtube.tv",
          "data_uri": "https://www.youtube.com/watch?v=YOUR_VIDEO_ID" 
        }
      ]
    },
    {
      "name": "Night Sleep",
      "cron": "0 0 23 * * *",
      "actions": [
        { "type": "shell", "command": "input keyevent KEYCODE_SLEEP" }
      ]
    }
  ]
}

```

---

## 4. 关键技术实现细节

### 4.1 YouTube 深度链接 (Deep Link) 实现

在 Android TV 上启动特定 YouTube 视频或频道，不能仅启动 App，需要发送 Intent。

* **ADB 原生指令**：
```bash
am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=VIDEO_ID" -n com.google.android.youtube.tv/.Main

```


* **代码层封装**：
在 Node.js 中，需要将配置中的 `data_uri` 转换为上述 shell 命令。

### 4.2 错误处理与重试

* **场景**：电视断电或网络中断。
* **机制**：在执行任务前进行 `ping` 检查。如果连接失败，尝试 `adb connect` 重连 3 次。如果依然失败，记录日志并跳过本次任务。

---

## 5. 开发环境与技术栈 (Technology Stack)

基于您的技术背景，推荐以下配置：

* **运行时**: Node.js (v18+)
* **核心库**:
* `adb-kit`: 用于与 Android 设备通讯。
* `node-schedule`: 用于处理 Cron 定时任务。
* `winston`: 用于记录运行日志（便于排查为何没播放）。


* **开发工具**: VSCode (使用 ESLint + Prettier)。
* **部署方式 (推荐)**: Docker 容器化部署。
* *理由*: 您可以将此服务跑在 NAS 或服务器上，Docker 能保证 Node 环境一致性，且易于后台运行。



---

## 6. 实施路线图 (Roadmap)

### 阶段一：原型验证 (POC)

1. 初始化 Node.js 项目 (`npm init`).
2. 安装 `adb-kit`。
3. 编写 `test.js`: 硬编码 IP，测试能否连接电视并发送“静音”指令。

### 阶段二：核心功能开发

1. 实现 `ConfigLoader`：读取 JSON 配置。
2. 实现 `TaskRunner`：解析配置并调用 ADB。
3. **重点攻克**：调试 YouTube 的 `am start` 参数，确保能准确跳转到视频/播放列表，而不仅仅是打开 App 首页。

### 阶段三：容器化与交付

1. 编写 `Dockerfile`。
2. 编写 `docker-compose.yml` (挂载 `tasks.config.json` 到容器外，方便修改配置)。

---
