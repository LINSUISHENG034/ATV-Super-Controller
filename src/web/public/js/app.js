/**
 * ATV Super Controller - Frontend Logic
 * Uses Alpine.js for interactivity
 */

function appData() {
  return {
    // State
    activeTab: 'dashboard',
    isConnected: false,
    deviceIp: 'Connecting...',
    tasks: [],
    recentActivity: [],
    logs: [],
    toast: { visible: false, message: '' },
    ws: null,

    // Navigation Items
    navItems: [
      { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge-high' },
      { id: 'tasks', label: 'Tasks', icon: 'fa-solid fa-list-check' },
      { id: 'remote', label: 'Remote', icon: 'fa-solid fa-gamepad' },
      { id: 'logs', label: 'Logs', icon: 'fa-solid fa-terminal' }
    ],

    /**
     * Initialize the application
     */
    init() {
      console.log('Initializing ATV Super Controller Dashboard...');
      this.fetchStatus();
      this.fetchTasks();
      this.fetchActivity();
      this.connectWebSocket();

      // Refresh status periodically as fallback
      setInterval(() => this.fetchStatus(), 30000);
      setInterval(() => this.fetchTasks(), 60000); // Refresh tasks every minute
    },

    /**
     * Fetch system status
     */
    async fetchStatus() {
      try {
        const res = await fetch('/api/v1/status');
        const data = await res.json();
        if (data.success) {
          this.isConnected = data.data.device.connected;
          this.deviceIp = data.data.device.target || 'Disconnected';
          if (!this.isConnected && data.data.device.reconnecting) {
              this.deviceIp = 'Reconnecting...';
          }
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
        this.isConnected = false;
        this.deviceIp = 'Offline';
      }
    },

    /**
     * Fetch scheduled tasks
     */
    async fetchTasks() {
      try {
        const res = await fetch('/api/v1/tasks');
        const data = await res.json();
        if (data.success) {
          this.tasks = data.data.tasks;
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
        this.addLog('Failed to fetch tasks', 'ERROR');
      }
    },

    /**
     * Fetch recent activity log
     */
    async fetchActivity() {
      try {
        const res = await fetch('/api/v1/activity');
        const data = await res.json();
        if (data.success) {
          this.recentActivity = data.data;
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      }
    },

    /**
     * Connect to WebSocket server
     */
    connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.addLog('WebSocket connected', 'DEBUG');
        this.ws.send(JSON.stringify({ type: 'subscribe', channel: 'status' }));
        this.ws.send(JSON.stringify({ type: 'subscribe', channel: 'tasks' }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting in 5s...');
        this.addLog('WebSocket disconnected', 'WARN');
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    },

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(message) {
      if (message.type === 'status:device:connected') {
        this.isConnected = true;
        this.deviceIp = message.data.target;
        this.showToast('Device Connected');
        this.addLog(`Connected to ${message.data.target}`, 'INFO');
      }
      else if (message.type === 'status:device:disconnected') {
        this.isConnected = false;
        this.deviceIp = 'Disconnected';
        this.showToast('Device Disconnected');
        this.addLog(`Disconnected from ${message.data.target}`, 'WARN');
      }
      else if (message.type === 'task:completed') {
        this.fetchActivity(); // Refresh activity log
        this.fetchTasks(); // Refresh task list for updated next run times
        this.showToast(`Task Completed: ${message.data.task}`);
        this.addLog(`Task completed: ${message.data.task}`, 'INFO');

        // Update task status in list
        const task = this.tasks.find(t => t.name === message.data.task);
        if (task) {
          task.lastStatus = 'completed';
          task.lastRunTime = new Date().toLocaleTimeString();
          task.running = false;
        }
      }
      else if (message.type === 'task:failed') {
        this.fetchActivity(); // Refresh activity log
        this.fetchTasks(); // Refresh task list
        this.showToast(`Task Failed: ${message.data.task}`);
        this.addLog(`Task failed: ${message.data.task}`, 'ERROR');

        // Update task status in list
        const task = this.tasks.find(t => t.name === message.data.task);
        if (task) {
          task.lastStatus = 'failed';
          task.lastRunTime = new Date().toLocaleTimeString();
          task.running = false;
        }
      }
      else if (message.type === 'task:triggered') {
        this.addLog(`Task triggered: ${message.data.taskName}`, 'INFO');

        // Update task running state
        const task = this.tasks.find(t => t.name === message.data.taskName);
        if (task) {
          task.running = true;
        }
      }
      else if (message.type === 'task:enabled' || message.type === 'task:disabled') {
        // Refresh task list when task is enabled/disabled
        this.fetchTasks();
        this.addLog(`Task ${message.data.taskName} ${message.type === 'task:enabled' ? 'enabled' : 'disabled'}`, 'INFO');
      }
    },

    /**
     * Trigger a manual action
     * @param {string} action - Action name (wake, shutdown, youtube, reconnect)
     */
    async triggerAction(action) {
      if (action === 'reconnect') {
        return this.toggleConnection();
      }

      // Map 'youtube' to 'launch' with params
      let endpoint = `/api/v1/actions/${action}`;
      let body = {};

      if (action === 'youtube') {
        endpoint = '/api/v1/actions/launch';
        body = { package: 'com.google.android.youtube' };
      }

      try {
        this.showToast(`Sending command: ${action}...`);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        const data = await res.json();
        
        if (data.success) {
          this.showToast(`Action '${action}' initiated`);
          this.addLog(`Manual action triggered: ${action}`, 'INFO');
          // Update activity after short delay to catch the new log entry
          setTimeout(() => this.fetchActivity(), 1000);
        } else {
          this.showToast(`Error: ${data.error.message}`);
          this.addLog(`Action failed: ${data.error.message}`, 'ERROR');
        }
      } catch (error) {
        this.showToast('Network Error');
        this.addLog(`Network error triggering ${action}`, 'ERROR');
      }
    },

    /**
     * Toggle connection (Reconnect logic)
     */
    async toggleConnection() {
      this.showToast('Reconnecting...');
      this.deviceIp = 'Reconnecting...';
      try {
        const res = await fetch('/api/v1/device/reconnect', { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
             this.showToast(`Reconnect failed: ${data.error.message}`);
        }
      } catch (error) {
        this.showToast('Reconnect request failed');
      }
    },

    /**
     * Show a toast message
     */
    showToast(message) {
      this.toast.message = message;
      this.toast.visible = true;
      setTimeout(() => { this.toast.visible = false }, 3000);
    },

    /**
     * Add local log (for Logs tab)
     */
    addLog(message, type = 'INFO') {
      const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
      this.logs.unshift({ time: `[${time}]`, type, message });
      if (this.logs.length > 50) this.logs.pop();
    },

    /**
     * Toggle task enabled/disabled
     * @param {string} taskName - Name of the task to toggle
     * @param {boolean} enabled - New enabled state
     */
    async toggleTask(taskName, enabled) {
      const task = this.tasks.find(t => t.name === taskName);
      if (!task) return;

      // Optimistic UI update
      const originalState = task.enabled;
      task.enabled = enabled;
      task.toggling = true;

      try {
        const res = await fetch(`/api/v1/tasks/${encodeURIComponent(taskName)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled })
        });

        const data = await res.json();

        if (data.success) {
          this.showToast(`Task ${taskName} ${enabled ? 'enabled' : 'disabled'}`);
          this.addLog(`Task ${taskName} ${enabled ? 'enabled' : 'disabled'}`, 'INFO');
        } else {
          // Revert on error
          task.enabled = originalState;
          this.showToast(`Error: ${data.error.message}`);
          this.addLog(`Toggle failed: ${data.error.message}`, 'ERROR');
        }
      } catch (error) {
        // Revert on network error
        task.enabled = originalState;
        this.showToast('Network Error');
        this.addLog(`Network error toggling task ${taskName}`, 'ERROR');
      } finally {
        task.toggling = false;
      }
    },

    /**
     * Run a task immediately
     * @param {string} taskName - Name of the task to run
     */
    async runTask(taskName) {
      const task = this.tasks.find(t => t.name === taskName);
      if (!task) return;

      if (task.running) {
        this.showToast('Task already running');
        return;
      }

      task.running = true;

      try {
        const res = await fetch(`/api/v1/tasks/${encodeURIComponent(taskName)}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (data.success) {
          this.showToast(`Task triggered: ${taskName}`);
          this.addLog(`Manual trigger: ${taskName}`, 'INFO');
          // Note: task.running will be reset by WebSocket task:completed/task:failed events
        } else {
          task.running = false;
          this.showToast(`Error: ${data.error.message}`);
          this.addLog(`Run failed: ${data.error.message}`, 'ERROR');
        }
      } catch (error) {
        task.running = false;
        this.showToast('Network Error');
        this.addLog(`Network error running task ${taskName}`, 'ERROR');
      }
    }
  }
}
