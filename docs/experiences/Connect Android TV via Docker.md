Connecting to an Android TV over a TCP network from a Docker container requires setting up the TV for remote debugging and ensuring the Docker container can persist authentication keys so you don't have to re-approve the connection every time the container restarts.

Here is the step-by-step guide.

### **Phase 1: Prepare the Android TV**

Before touching Docker, you must enable network debugging on your TV.

1. **Enable Developer Options:**  
   * Go to **Settings \> Device Preferences \> About**.  
   * Scroll down to **Build** (or **Android TV OS build**) and click it **7 times** rapidly. You will see a toast message saying "You are now a developer".

2. **Enable Network Debugging:**  
   * Go back to **Settings \> Device Preferences \> Developer options**.  
   * Enable **USB Debugging**.

   * Look for an option called **Network Debugging** (or "ADB over Network") and enable it.  
   * *Note: If your TV does not have the "Network Debugging" toggle, you may need to connect via USB once and run adb tcpip 5555 to switch it to TCP mode.*

3. **Get the IP Address:**  
   * Go to **Settings \> Network & Internet** and note the IP address of your TV (e.g., 192.168.1.50).

### ---

**Phase 2: Docker Setup (The "Persistent" Way)**

The most common issue with ADB in Docker is **Authentication**. When you connect, ADB generates a cryptographic key pair (adbkey and adbkey.pub). If you don't save these, a new key is generated every time the container restarts, forcing you to re-approve the connection on the TV constantly.

We will mount a volume to save these keys.

#### **1\. Create a directory for keys**

On your host machine (where Docker is running), create a folder to store the ADB keys:

Bash

mkdir \-p $HOME/adb-keys

#### **2\. Run the Docker Container**

We will use the lightweight alpine image and install ADB tools inside it. Run this command:

Bash

docker run \-it \--rm \\  
  \--name adb-container \\  
  \-v $HOME/adb-keys:/root/.android \\  
  alpine:latest /bin/sh

* **\-v $HOME/adb-keys:/root/.android**: This maps your local folder to the container's ADB key storage.  
* **alpine:latest**: A very small Linux image.

### ---

**Phase 3: Connect to the TV**

Once you are inside the container's shell (you should see a prompt like / \#), follow these steps:

1. **Install ADB:**  
   Bash  
   apk add android-tools

2. **Start the Server:**  
   Bash  
   adb start-server

3. **Connect to the TV:**  
   Replace 192.168.1.50 with your TV's actual IP.  
   Bash  
   adb connect 192.168.1.50

4. **Authorize on TV (Crucial Step):**  
   * Look at your TV screen immediately. You will see a popup: **"Allow USB debugging?"** (it says USB even for network connections).  
   * Check **"Always allow from this computer"**.  
   * Select **Allow**.  
5. **Verify Connection:**  
   Back in the container, check the status:  
   Bash  
   adb devices

   * **Success:** You see 192.168.1.50:5555 device.  
   * **Failure:** You see unauthorized (you missed the popup) or offline.

### ---

**Phase 4: Automating with a Dockerfile**

If you want a permanent container that automatically has ADB installed, use this Dockerfile:

Dockerfile

\# Dockerfile  
FROM alpine:latest

\# Install ADB  
RUN apk add \--no-cache android-tools

\# Set working directory  
WORKDIR /app

\# Keep the container running  
CMD \["tail", "-f", "/dev/null"\]

**Build and Run:**

Bash

\# Build the image  
docker build \-t my-adb-client .

\# Run with key persistence  
docker run \-d \\  
  \--name android-bridge \\  
  \-v $HOME/adb-keys:/root/.android \\  
  my-adb-client

\# Execute commands inside the running container  
docker exec android-bridge adb connect 192.168.1.50  
docker exec android-bridge adb shell input keyevent 26  \# Toggles Power

### **Troubleshooting**

| Issue | Solution |
| :---- | :---- |
| **"Connection refused"** | Ensure the TV is on and "Network Debugging" is enabled. Ensure the Docker container is on a network that can reach the TV (Standard Bridge mode usually works, but if you have complex firewalls, try adding \--net=host to the docker run command). |
| **"Unauthorized" status** | You missed the popup on the TV. Disconnect using adb disconnect, then run adb connect again and watch the TV screen. |
| **"Device offline"** | The connection is stale. Run adb kill-server, then adb connect \<IP\> again. |
| **Connection drops often** | Android TV often puts the network card to sleep. Go to TV Settings and ensure "Wake on LAN" or "Standby apps" are configured to keep the connection alive. |

### 