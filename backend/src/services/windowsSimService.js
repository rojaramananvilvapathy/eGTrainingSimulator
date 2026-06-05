/**
 * windowsSimService.js
 *
 * Simulates a Windows Server GUI environment for eG Enterprise labs.
 * Since real Windows containers are heavyweight, this service provides:
 *   1. A scripted command-response engine for cmd/PowerShell commands
 *   2. A GUI wizard state machine for step-by-step installer simulation
 *   3. Screenshot-derived screen definitions loaded from YAML room configs
 *
 * Architecture:
 *   - Each session has a SimSession object holding OS state + wizard state
 *   - Commands are matched against a command registry, returning realistic output
 *   - GUI actions trigger screen transitions in the wizard state machine
 *   - Flag conditions are evaluated after each command/action
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// ── In-memory session store (replace with Redis in production) ─
const sessions = new Map();

// ════════════════════════════════════════════════════════════════
//  WINDOWS SERVER ENVIRONMENT TEMPLATES
// ════════════════════════════════════════════════════════════════
const WIN_ENVIRONMENTS = {
  'windows-server-2019': {
    osName:       'Windows Server 2019 Standard',
    osVersion:    '10.0.17763',
    buildNumber:  '17763',
    ram_gb:       16,
    disk_free_gb: 120,
    cpu:          'Intel(R) Xeon(R) Gold 6254 CPU @ 3.10GHz',
    hostname:     'EG-MGMT-SRV01',
    dotnet:       '528040',   // .NET 4.8
    java_version: '11.0.21',
    java_vendor:  'Eclipse Adoptium',
    ports_in_use: [80, 135, 139, 445, 3389],
    selinux:      'N/A (Windows)',
  },
};

// ════════════════════════════════════════════════════════════════
//  COMMAND REGISTRY — cmd.exe + PowerShell scripted responses
// ════════════════════════════════════════════════════════════════
function buildCommandRegistry(env) {
  return {
    // ── System Info ───────────────────────────────────────────
    'systeminfo': () => `
Host Name:                 ${env.hostname}
OS Name:                   Microsoft ${env.osName}
OS Version:                ${env.osVersion} N/A Build ${env.buildNumber}
OS Manufacturer:           Microsoft Corporation
OS Configuration:          Standalone Server
System Type:               x64-based PC
Processor(s):              1 Processor(s) Installed.
                           [01]: ${env.cpu}
Total Physical Memory:     ${env.ram_gb * 1024} MB
Available Physical Memory: ${Math.floor(env.ram_gb * 1024 * 0.6)} MB
`,

    'ver': () => `\r\nMicrosoft Windows [Version ${env.osVersion}]\r\n`,

    'hostname': () => `${env.hostname}\r\n`,

    // ── Memory ────────────────────────────────────────────────
    'wmic os get TotalVisibleMemorySize /value': () =>
      `TotalVisibleMemorySize=${env.ram_gb * 1024 * 1024}\r\n`,

    'wmic os get FreePhysicalMemory /value': () =>
      `FreePhysicalMemory=${Math.floor(env.ram_gb * 1024 * 1024 * 0.6)}\r\n`,

    // ── Disk ──────────────────────────────────────────────────
    'dir c:\\': () => `
 Volume in drive C has no label.
 Volume Serial Number is A4B2-C3D1

 Directory of C:\\

01/15/2024  09:00 AM    <DIR>          inetpub
01/15/2024  09:00 AM    <DIR>          Program Files
01/15/2024  09:00 AM    <DIR>          Program Files (x86)
01/15/2024  09:00 AM    <DIR>          Users
01/15/2024  09:00 AM    <DIR>          Windows
               0 File(s)              0 bytes
               5 Dir(s)  ${env.disk_free_gb},${Math.floor(Math.random()*900+100)},234,496 bytes free
`,

    'get-psdrive c': () =>
      `Name Used (GB) Free (GB) Provider Root\r\n---- --------- --------- -------- ----\r\nC    ${(128 - env.disk_free_gb).toFixed(2)}       ${env.disk_free_gb.toFixed(2)}      FileSystem C:\\\r\n`,

    // ── Java ──────────────────────────────────────────────────
    'java -version': () =>
      `openjdk version "${env.java_version}" 2023-10-17\r\nOpenJDK Runtime Environment Temurin-11.0.21+9 (build ${env.java_version}+9)\r\nOpenJDK 64-Bit Server VM Temurin-11.0.21+9 (build ${env.java_version}+9, mixed mode)\r\n`,

    'java --version': () =>
      `openjdk ${env.java_version} 2023-10-17\r\nOpenJDK Runtime Environment Temurin-11.0.21+9 (build ${env.java_version}+9)\r\nOpenJDK 64-Bit Server VM Temurin-11.0.21+9 (build ${env.java_version}+9, mixed mode)\r\n`,

    '%java_home%\\bin\\java -version': () =>
      `openjdk version "${env.java_version}" 2023-10-17\r\nOpenJDK Runtime Environment Temurin-11.0.21+9\r\n`,

    'echo %java_home%': () => `C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.21.9-hotspot\r\n`,

    // ── .NET ──────────────────────────────────────────────────
    "(get-itemproperty 'hklm:\\software\\microsoft\\net framework setup\\ndp\\v4\\full').release":
      () => `${env.dotnet}\r\n`,

    "get-childitem 'hklm:\\software\\microsoft\\net framework setup\\ndp'":
      () => `
    Hive: HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP

Name           Property
----           --------
v2.0.50727     Install         : 1
               Version         : 2.0.50727.4927
v3.0           Install         : 1
               Version         : 3.0.30729.4926
v3.5           Install         : 1
               Version         : 3.5.30729.4926
v4             Client          : {Install=1}
               Full            : {Install=1,Release=${env.dotnet},Version=4.8.09037}
`,

    // ── Network/Ports ─────────────────────────────────────────
    'netstat -ano': () => {
      const listenLines = env.ports_in_use.map(p =>
        `  TCP    0.0.0.0:${p.toString().padEnd(5)}         0.0.0.0:0              LISTENING       ${Math.floor(Math.random()*3000+500)}`
      ).join('\r\n');
      return `\r\nActive Connections\r\n\r\n  Proto  Local Address          Foreign Address        State           PID\r\n${listenLines}\r\n`;
    },

    'netstat -ano | findstr "7076 7077"': () =>
      `\r\n`,  // Empty = ports are free

    'netstat -ano | findstr "443"': () =>
      `  TCP    0.0.0.0:443            0.0.0.0:0              LISTENING       4\r\n`,

    // ── PowerShell ────────────────────────────────────────────
    'get-service | where-object {$_.status -eq "running"}': () =>
      `Status   Name               DisplayName\r\n------   ----               -----------\r\nRunning  EventLog           Windows Event Log\r\nRunning  LanmanServer       Server\r\nRunning  MpsSvc             Windows Defender Firewall\r\nRunning  RpcSs              Remote Procedure Call (RPC)\r\nRunning  Winmgmt            Windows Management Instrumentation\r\n`,

    'get-process': () =>
      `Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\r\n-------  ------    -----      -----     ------     --  -- -----------\r\n    412      23     8124      32456       2.34    576   0 lsass\r\n    210      14     4200      16000       0.22   1232   0 services\r\n    188      12     3800      12000       0.11    984   0 svchost\r\n`,

    'ipconfig': () =>
      `\r\nWindows IP Configuration\r\n\r\nEthernet adapter Ethernet0:\r\n\r\n   Connection-specific DNS Suffix  . :\r\n   IPv4 Address. . . . . . . . . . . : 192.168.1.100\r\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\r\n   Default Gateway . . . . . . . . . : 192.168.1.1\r\n`,

    'ipconfig /all': () =>
      `\r\nWindows IP Configuration\r\n\r\n   Host Name . . . . . . . . . . . . : ${env.hostname}\r\n   Primary Dns Suffix  . . . . . . . :\r\n   Node Type . . . . . . . . . . . . : Hybrid\r\n   IP Routing Enabled. . . . . . . . : No\r\n\r\nEthernet adapter Ethernet0:\r\n   IPv4 Address. . . . . . . . . . . : 192.168.1.100\r\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\r\n   Default Gateway . . . . . . . . . : 192.168.1.1\r\n   DNS Servers . . . . . . . . . . . : 8.8.8.8\r\n`,

    // ── Environment variables ─────────────────────────────────
    'set': () =>
      `COMPUTERNAME=${env.hostname}\r\nJAVA_HOME=C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.21.9-hotspot\r\nOS=Windows_NT\r\nPATH=C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.21.9-hotspot\\bin\r\nPROCESSOR_ARCHITECTURE=AMD64\r\nUSERNAME=Administrator\r\n`,

    'echo %computername%': () => `${env.hostname}\r\n`,
    'echo %username%':     () => `Administrator\r\n`,
    'echo %os%':           () => `Windows_NT\r\n`,
    'echo %path%':         () => `C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.21.9-hotspot\\bin\r\n`,

    // ── Firewall ──────────────────────────────────────────────
    'netsh advfirewall show allprofiles': () =>
      `Domain Profile Settings:\r\n----------------------------------------------------------------------\r\nState                                 ON\r\nFirewallPolicy                        BlockInbound,AllowOutbound\r\n\r\nPrivate Profile Settings:\r\n----------------------------------------------------------------------\r\nState                                 ON\r\n\r\nPublic Profile Settings:\r\n----------------------------------------------------------------------\r\nState                                 ON\r\n`,

    'netsh advfirewall firewall show rule name=all': () =>
      `Rule Name:                            Remote Desktop - User Mode (TCP-In)\r\nEnabled:                              Yes\r\nDirection:                            In\r\nProfiles:                             Private,Domain\r\nAction:                               Allow\r\nProtocol:                             TCP\r\nLocalPort:                            3389\r\n\r\nRule Name:                            Windows Management Instrumentation (WMI-In)\r\nEnabled:                              Yes\r\nDirection:                            In\r\nAction:                               Allow\r\n`,

    // ── Help / default ────────────────────────────────────────
    'help': () =>
      `\r\nFor more information on a specific command, type HELP command-name\r\nCLS      COPY     DATE     DEL      DIR      ECHO     EXIT\r\nFIND     FINDSTR  HELP     HOSTNAME IPCONFIG MKDIR    MORE\r\nMOVE     NET      NETSTAT  PATH     PING     REN      SET\r\nSYSTEMINFO       TASKLIST TASKKILL TIME     TYPE     VER\r\n`,

    'cls': () => '\x1b[2J\x1b[H',

    'exit': () => '\r\nSession closed.\r\n',
  };
}

// ════════════════════════════════════════════════════════════════
//  GUI WIZARD STATE MACHINE
// ════════════════════════════════════════════════════════════════
const GUI_SCREENS = {
  // msinfo32 screens
  'msinfo32': {
    title:  'System Information',
    fields: (env) => ({
      'OS Name':                `Microsoft ${env.osName}`,
      'Version':                env.osVersion,
      'OS Manufacturer':        'Microsoft Corporation',
      'System Type':            'x64-based PC',
      'Processor':              env.cpu,
      'BIOS Version/Date':      'American Megatrends Inc.',
      'Installed Physical Memory (RAM)': `${env.ram_gb}.00 GB`,
      'Available Physical Memory': `${(env.ram_gb * 0.6).toFixed(2)} GB`,
    }),
  },

  // Task Manager — Performance tab
  'taskmgr_performance': {
    title: 'Task Manager — Performance',
    fields: (env) => ({
      'Installed RAM':  `${env.ram_gb}.0 GB`,
      'Available RAM':  `${(env.ram_gb * 0.6).toFixed(1)} GB`,
      'In Use':         `${(env.ram_gb * 0.4).toFixed(1)} GB`,
      'CPU Usage':      '12%',
      'CPU Speed':      '3.10 GHz',
      'Processes':      '48',
    }),
  },

  // Disk properties
  'disk_properties': {
    title: 'Local Disk (C:) Properties',
    fields: (env) => ({
      'Type':         'Local Disk',
      'File System':  'NTFS',
      'Used Space':   `${((128 - env.disk_free_gb) * 1073741824).toLocaleString()} bytes (${128 - env.disk_free_gb} GB)`,
      'Free Space':   `${(env.disk_free_gb * 1073741824).toLocaleString()} bytes (${env.disk_free_gb} GB)`,
      'Capacity':     `${128 * 1073741824} bytes (128 GB)`,
    }),
  },

  // Windows Firewall
  'firewall_advanced': {
    title: 'Windows Defender Firewall with Advanced Security',
    fields: () => ({
      'Domain Profile':   'Active — Inbound: Block, Outbound: Allow',
      'Private Profile':  'Active — Inbound: Block, Outbound: Allow',
      'Public Profile':   'Active — Inbound: Block, Outbound: Allow',
      'Existing Rules':   'Remote Desktop (3389), WMI, File/Printer Sharing',
    }),
  },

  // eG Manager Installer — Windows Wizard Screens
  'eg_installer_welcome': {
    title:   'eG Enterprise Setup — Welcome',
    message: 'Welcome to the eG Enterprise Manager Setup Wizard.\n\nThis will install eG Enterprise Manager on your computer.\n\nClick Next to continue or Cancel to exit.',
    buttons: ['Next', 'Cancel'],
    next:    'eg_installer_license',
  },

  'eg_installer_license': {
    title:   'eG Enterprise Setup — License Agreement',
    message: 'IMPORTANT: Please read this license agreement carefully before proceeding.\n\n[eG Innovations End User License Agreement — abbreviated for simulation]\n\nDo you accept all the terms of the license agreement?',
    buttons: ['I Agree', 'I Do Not Agree'],
    next:    'eg_installer_install_type',
  },

  'eg_installer_install_type': {
    title:   'eG Enterprise Setup — Installation Type',
    message: 'Select components to install:',
    options: [
      { id: 'manager',  label: 'eG Manager (required)',           checked: true,  disabled: true },
      { id: 'agent',    label: 'eG Agent (install on same host)',  checked: false, disabled: false },
      { id: 'console',  label: 'eG Integrated Console (web)',      checked: true,  disabled: false },
    ],
    buttons: ['Back', 'Next'],
    next: 'eg_installer_install_dir',
  },

  'eg_installer_install_dir': {
    title:   'eG Enterprise Setup — Install Location',
    message: 'Select the folder where Setup will install eG Enterprise Manager.',
    field:   { label: 'Destination Folder', value: 'C:\\eGurkha', editable: true },
    buttons: ['Back', 'Next'],
    next:    'eg_installer_db_config',
  },

  'eg_installer_db_config': {
    title:   'eG Enterprise Setup — Database Configuration',
    message: 'Configure the eG Enterprise backend database.\n\n⚠ eG Enterprise supports MS SQL Server (Standard/Enterprise) and Oracle DB only.',
    fields: [
      { id: 'db_type',     label: 'Database Type',  type: 'select',   options: ['MS SQL Server', 'Oracle'], value: 'MS SQL Server' },
      { id: 'db_host',     label: 'DB Server Host',  type: 'text',     value: 'localhost' },
      { id: 'db_port',     label: 'Port',            type: 'text',     value: '1433' },
      { id: 'db_name',     label: 'Database Name',   type: 'text',     value: 'egdb' },
      { id: 'db_user',     label: 'DB Username',     type: 'text',     value: 'egdbuser' },
      { id: 'db_password', label: 'DB Password',     type: 'password', value: '' },
    ],
    buttons: ['Back', 'Next'],
    next:    'eg_installer_manager_config',
  },

  'eg_installer_manager_config': {
    title:   'eG Enterprise Setup — Manager Settings',
    message: 'Configure the eG Manager listening ports.',
    fields: [
      { id: 'http_port',   label: 'Manager HTTP Port',   type: 'text', value: '7076' },
      { id: 'agent_port',  label: 'Agent Comm Port',     type: 'text', value: '7077' },
      { id: 'ssl_enabled', label: 'Enable HTTPS',        type: 'checkbox', value: false },
    ],
    buttons: ['Back', 'Install'],
    next:    'eg_installer_progress',
  },

  'eg_installer_progress': {
    title:   'eG Enterprise Setup — Installing...',
    message: 'Installing eG Enterprise Manager. Please wait...',
    progress: [
      'Extracting files...',
      'Installing Java runtime...',
      'Configuring Tomcat...',
      'Creating database schema...',
      'Configuring Manager service...',
      'Starting eG Manager service...',
    ],
    buttons: [],
    next:    'eg_installer_complete',
    auto_advance_ms: 3000,
  },

  'eg_installer_complete': {
    title:   'eG Enterprise Setup — Complete',
    message: '✅ eG Enterprise Manager has been successfully installed!\n\nThe Manager service is starting. Access the console at:\nhttp://localhost:7076/eg\n\nDefault credentials:\n  Username: admin\n  Password: admin (change on first login)',
    buttons: ['Finish'],
    flag_trigger: 'installation_complete',
  },
};

// ════════════════════════════════════════════════════════════════
//  SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════════
function createSession(userId, roomId, envType = 'windows-server-2019') {
  const env = WIN_ENVIRONMENTS[envType];
  if (!env) throw new Error(`Unknown environment type: ${envType}`);

  const sessionId = uuidv4();
  const session = {
    id:           sessionId,
    userId,
    roomId,
    env,
    commandRegistry: buildCommandRegistry(env),
    currentScreen:   null,
    wizardData:      {},
    commandHistory:  [],
    flagsTriggered:  new Set(),
    createdAt:       Date.now(),
  };

  sessions.set(sessionId, session);
  logger.info('Windows sim session created', { sessionId, userId, roomId });
  return sessionId;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found or expired');
  return session;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

// ════════════════════════════════════════════════════════════════
//  COMMAND EXECUTION
// ════════════════════════════════════════════════════════════════
function executeCommand(sessionId, rawInput) {
  const session = getSession(sessionId);
  const cmd     = rawInput.trim().toLowerCase();

  session.commandHistory.push({ cmd: rawInput, ts: Date.now() });

  const registry = session.commandRegistry;

  // Exact match
  if (registry[cmd]) {
    const output = registry[cmd]();
    return { output, flagTriggered: checkFlagCondition(session, cmd, output) };
  }

  // Prefix match (e.g. 'netstat -ano | findstr ...')
  const prefixMatch = Object.keys(registry).find(k => cmd.startsWith(k) || k.startsWith(cmd.split(' ')[0]));
  if (prefixMatch && registry[prefixMatch]) {
    const output = registry[prefixMatch]();
    return { output, flagTriggered: checkFlagCondition(session, cmd, output) };
  }

  // Unknown command — Windows-style error
  const cmdName = rawInput.split(' ')[0];
  return {
    output: `'${cmdName}' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n`,
    flagTriggered: false,
  };
}

// ════════════════════════════════════════════════════════════════
//  GUI WIZARD ACTIONS
// ════════════════════════════════════════════════════════════════
function openScreen(sessionId, screenId) {
  const session = getSession(sessionId);
  const screen  = GUI_SCREENS[screenId];
  if (!screen) throw new Error(`Unknown screen: ${screenId}`);

  session.currentScreen = screenId;

  // Resolve dynamic fields
  const resolved = { ...screen };
  if (typeof resolved.fields === 'function') {
    resolved.fields = resolved.fields(session.env);
  }

  return { screen: resolved, sessionId };
}

function advanceWizard(sessionId, buttonLabel, formData = {}) {
  const session  = getSession(sessionId);
  const screenId = session.currentScreen;
  if (!screenId) throw new Error('No active screen');

  const screen = GUI_SCREENS[screenId];
  if (!screen) throw new Error(`Screen not found: ${screenId}`);

  // Merge form data into session
  Object.assign(session.wizardData, formData);

  // Check for DB config validation (eG-specific)
  if (screenId === 'eg_installer_db_config') {
    const dbType = formData.db_type || session.wizardData.db_type;
    if (dbType && !['MS SQL Server', 'Oracle'].includes(dbType)) {
      return {
        error: '⚠ eG Enterprise only supports MS SQL Server and Oracle DB.\nMySQL and other databases are not supported for the eG backend.',
        screen: GUI_SCREENS[screenId],
      };
    }
    if (!formData.db_password?.length) {
      return { error: 'DB Password is required.', screen: GUI_SCREENS[screenId] };
    }
  }

  // Flag trigger on specific screens
  let flagTriggered = null;
  if (screen.flag_trigger) {
    session.flagsTriggered.add(screen.flag_trigger);
    flagTriggered = screen.flag_trigger;
  }

  // Advance to next screen
  if (screen.next && buttonLabel !== 'Cancel' && buttonLabel !== 'I Do Not Agree') {
    session.currentScreen = screen.next;
    const nextScreen = GUI_SCREENS[screen.next];
    const resolved = { ...nextScreen };
    if (typeof resolved.fields === 'function') {
      resolved.fields = resolved.fields(session.env);
    }
    return { screen: resolved, flagTriggered };
  }

  return { screen: GUI_SCREENS[screenId], flagTriggered };
}

// ════════════════════════════════════════════════════════════════
//  FLAG CONDITION EVALUATOR
// ════════════════════════════════════════════════════════════════
function checkFlagCondition(session, cmd, output) {
  // This is called per-command; specific room tasks define their own conditions
  // Here we just return the output for the room runner to evaluate against task config
  return false;
}

function evaluateTaskCondition(condition, trigger, cmd, output) {
  switch (condition) {
    case 'output_contains':
      return new RegExp(trigger, 'i').test(output);
    case 'output_does_not_contain':
      return !new RegExp(trigger, 'i').test(output);
    case 'command_matches':
      return new RegExp(trigger, 'i').test(cmd);
    case 'gui_action_complete':
      return true; // Triggered by wizard advance
    default:
      return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  SOCKET.IO INTEGRATION
// ════════════════════════════════════════════════════════════════
function attachWindowsSimService(io) {
  const winNS = io.of('/windows-sim');

  winNS.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const { verifyAccessToken } = require('./tokenService');
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  winNS.on('connection', (socket) => {
    logger.info('Windows sim socket connected', { userId: socket.userId });
    let sessionId = null;

    socket.on('win:start', ({ roomId, envType }) => {
      try {
        sessionId = createSession(socket.userId, roomId, envType);
        socket.emit('win:ready', {
          sessionId,
          prompt: `C:\\Users\\Administrator>`,
          welcome: `\r\nMicrosoft Windows [Version ${WIN_ENVIRONMENTS[envType || 'windows-server-2019'].osVersion}]\r\n(c) Microsoft Corporation. All rights reserved.\r\n\r\nC:\\Users\\Administrator>`,
        });
      } catch (err) {
        socket.emit('win:error', { message: err.message });
      }
    });

    socket.on('win:cmd', ({ input }) => {
      if (!sessionId) return socket.emit('win:error', { message: 'No active session' });
      try {
        const result = executeCommand(sessionId, input);
        const session = getSession(sessionId);
        socket.emit('win:output', {
          output: result.output,
          prompt: `C:\\Users\\Administrator>`,
          flagTriggered: result.flagTriggered,
        });
      } catch (err) {
        socket.emit('win:error', { message: err.message });
      }
    });

    socket.on('win:gui:open', ({ screenId }) => {
      if (!sessionId) return socket.emit('win:error', { message: 'No active session' });
      try {
        const result = openScreen(sessionId, screenId);
        socket.emit('win:gui:screen', result);
      } catch (err) {
        socket.emit('win:error', { message: err.message });
      }
    });

    socket.on('win:gui:action', ({ buttonLabel, formData }) => {
      if (!sessionId) return socket.emit('win:error', { message: 'No active session' });
      try {
        const result = advanceWizard(sessionId, buttonLabel, formData);
        socket.emit('win:gui:screen', result);
      } catch (err) {
        socket.emit('win:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      if (sessionId) destroySession(sessionId);
      logger.info('Windows sim socket disconnected', { userId: socket.userId });
    });
  });
}

module.exports = {
  createSession, getSession, destroySession,
  executeCommand, openScreen, advanceWizard,
  evaluateTaskCondition, attachWindowsSimService,
  GUI_SCREENS, WIN_ENVIRONMENTS,
};
