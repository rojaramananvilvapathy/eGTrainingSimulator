/**
 * dynamicLabGenerator.js
 *
 * Phase 6 — Task 6: Dynamic Troubleshooting Simulation Generator
 *
 * Admin inputs a scenario definition; this service:
 *   1. Validates the inputs
 *   2. Generates a complete YAML room definition from a template
 *   3. Injects realistic error states into the chosen OS environment
 *   4. Registers the room in the database
 *   5. Returns the room slug for immediate use
 *
 * Supported scenario types:
 *   - agent_manager_disconnect
 *   - db_auth_failure
 *   - port_conflict
 *   - service_crash
 *   - ssl_cert_expired
 *   - log_analysis
 *   - custom (free-form)
 */

const yaml   = require('js-yaml');
const { v4: uuidv4 } = require('uuid');
const db     = require('../../backend/src/db');
const logger = require('../../backend/src/config/logger');

// ── Scenario templates ────────────────────────────────────────
const SCENARIO_TEMPLATES = {

  agent_manager_disconnect: {
    title:       'Troubleshoot: eG Agent — Manager Disconnect',
    description: 'The eG Agent on this host has lost connectivity to the eG Manager. Investigate the root cause and restore the connection.',
    difficulty:  'medium',
    category:    'troubleshooting',
    taskTemplates: (inputs) => [
      {
        sequence: 1, title: 'Check agent service status', type: 'terminal', points: 20,
        description: `The eG Agent service may have stopped. Check its current status on ${inputs.os === 'windows' ? 'Windows' : 'Linux'}.`,
        expected_commands: inputs.os === 'linux'
          ? ['systemctl status egurkha-agent', 'service egurkha-agent status']
          : ['sc query egurkhaagent', 'Get-Service -Name egurkhaagent'],
        flag_condition: 'output_contains',
        flag_trigger: 'active|running|RUNNING|stopped|inactive',
        hints: [
          { tier: 1, cost: 10, text: inputs.os === 'linux' ? 'Use systemctl to check service status.' : 'Use sc query or Get-Service in PowerShell.' },
          { tier: 2, cost: 20, text: inputs.os === 'linux' ? 'systemctl status egurkha-agent' : 'sc query egurkhaagent' },
          { tier: 3, cost: 30, text: inputs.os === 'linux' ? 'systemctl status egurkha-agent — look for Active: field.' : 'sc query egurkhaagent | findstr STATE' },
        ],
        answer_explanation: 'The first step in any connectivity issue is confirming whether the agent service itself is running.',
      },
      {
        sequence: 2, title: 'Check agent configuration for Manager IP/port', type: 'terminal', points: 20,
        description: 'Verify the eG Agent is configured with the correct Manager IP address and port (7077).',
        expected_commands: inputs.os === 'linux'
          ? ['cat /opt/egurkha/agent/config/agent.properties', 'grep -i manager /opt/egurkha/agent/config/agent.properties']
          : ['type "C:\\eGurkha\\agent\\config\\agent.properties"', 'findstr /i manager "C:\\eGurkha\\agent\\config\\agent.properties"'],
        flag_condition: 'output_contains',
        flag_trigger: 'manager.host|manager.ip|managerHost|7077',
        hints: [
          { tier: 1, cost: 10, text: 'The agent config file is in the agent/config directory.' },
          { tier: 2, cost: 20, text: inputs.os === 'linux' ? 'cat /opt/egurkha/agent/config/agent.properties' : 'Look in C:\\eGurkha\\agent\\config\\' },
          { tier: 3, cost: 30, text: 'Look for manager.host and manager.port properties — these must match the Manager server IP and port 7077.' },
        ],
        answer_explanation: 'The agent.properties file defines manager.host and manager.port. Misconfigured values are the #1 cause of disconnect.',
      },
      {
        sequence: 3, title: 'Test network connectivity to Manager port 7077', type: 'terminal', points: 20,
        description: `Test if port 7077 on the Manager host (${inputs.manager_host || '192.168.1.100'}) is reachable.`,
        expected_commands: inputs.os === 'linux'
          ? [`nc -zv ${inputs.manager_host || '192.168.1.100'} 7077`, `telnet ${inputs.manager_host || '192.168.1.100'} 7077`, 'ss -tlnp | grep 7077']
          : [`Test-NetConnection -ComputerName ${inputs.manager_host || '192.168.1.100'} -Port 7077`, `telnet ${inputs.manager_host || '192.168.1.100'} 7077`],
        flag_condition: 'output_contains',
        flag_trigger: 'succeeded|Connected|open|refused|failed|LISTEN',
        hints: [
          { tier: 1, cost: 10, text: 'Use nc (netcat) on Linux or Test-NetConnection on Windows.' },
          { tier: 2, cost: 20, text: inputs.os === 'linux' ? `nc -zv ${inputs.manager_host || '192.168.1.100'} 7077` : `Test-NetConnection ${inputs.manager_host || '192.168.1.100'} -Port 7077` },
          { tier: 3, cost: 30, text: '"Connection refused" means firewall is blocking port 7077. "succeeded" means network is fine — look at the agent config.' },
        ],
        answer_explanation: 'Port 7077 must be open on the Manager firewall. If refused, add a firewall rule to allow TCP 7077 inbound on the Manager host.',
      },
      {
        sequence: 4, title: 'Restart agent and verify reconnection', type: 'terminal', points: 30,
        description: 'After fixing the root cause, restart the agent service and verify it connects to the Manager.',
        expected_commands: inputs.os === 'linux'
          ? ['systemctl restart egurkha-agent', 'systemctl status egurkha-agent']
          : ['Restart-Service egurkhaagent', 'sc start egurkhaagent'],
        flag_condition: 'output_contains',
        flag_trigger: 'active (running)|RUNNING|Started|start pending',
        hints: [
          { tier: 1, cost: 10, text: 'Restart the agent service after fixing the configuration.' },
          { tier: 2, cost: 20, text: inputs.os === 'linux' ? 'systemctl restart egurkha-agent' : 'Restart-Service egurkhaagent' },
          { tier: 3, cost: 30, text: 'After restart: check logs at /opt/egurkha/agent/logs/egurkha.log for "Connected to Manager" confirmation.' },
        ],
        answer_explanation: 'After fixing manager.host or firewall rules, restart the agent. Confirm in logs: "Successfully connected to Manager at <ip>:7077".',
      },
    ],
  },

  db_auth_failure: {
    title:       'Troubleshoot: eG Manager — Database Authentication Failure',
    description: 'eG Manager is failing to connect to the MS SQL Server database. The Manager console is showing a DB connection error on startup.',
    difficulty:  'medium',
    category:    'troubleshooting',
    taskTemplates: (inputs) => [
      {
        sequence: 1, title: 'Check Manager startup logs for DB error', type: 'terminal', points: 20,
        description: 'The first step is identifying the exact error message from the eG Manager logs.',
        expected_commands: ['tail -100 /opt/egurkha/manager/logs/egurkha.log', 'grep -i "db\\|sql\\|connection\\|error" /opt/egurkha/manager/logs/egurkha.log'],
        flag_condition: 'output_contains',
        flag_trigger: 'Login failed|authentication|password|connection refused|SQLException',
        hints: [
          { tier: 1, cost: 10, text: 'Check the Manager logs — they contain the exact DB error.' },
          { tier: 2, cost: 20, text: 'tail -100 /opt/egurkha/manager/logs/egurkha.log | grep -i error' },
          { tier: 3, cost: 30, text: 'grep -i "sql\\|login\\|password\\|connection" /opt/egurkha/manager/logs/egurkha.log — look for "Login failed for user" or "Connection refused".' },
        ],
        answer_explanation: 'The log will show one of: Login failed for user (wrong credentials), Connection refused (SQL Server not running), or Network error (wrong host/port).',
      },
      {
        sequence: 2, title: 'Verify SQL Server is running', type: 'terminal', points: 15,
        description: 'Confirm the MS SQL Server service is active and port 1433 is listening.',
        expected_commands: ['ss -tlnp | grep 1433', 'systemctl status mssql-server', 'netstat -tlnp | grep 1433'],
        flag_condition: 'output_contains',
        flag_trigger: 'LISTEN.*1433|1433.*LISTEN|active (running)|mssql',
        hints: [
          { tier: 1, cost: 10, text: 'Check if SQL Server is listening on port 1433.' },
          { tier: 2, cost: 20, text: 'ss -tlnp | grep 1433' },
          { tier: 3, cost: 30, text: 'ss -tlnp | grep 1433 — if empty, SQL Server is stopped. Start with: systemctl start mssql-server' },
        ],
        answer_explanation: 'If port 1433 is not listening, SQL Server is stopped or misconfigured. Start it with: systemctl start mssql-server (Linux) or Start-Service MSSQLSERVER (Windows).',
      },
      {
        sequence: 3, title: 'Test SQL Server login with eG credentials', type: 'terminal', points: 25,
        description: 'Attempt to connect to SQL Server using the eG database credentials to confirm if it is a credential issue.',
        expected_commands: [`sqlcmd -S ${inputs.db_host || 'localhost'} -U egdbuser -P "${inputs.db_password || 'egdbpass'}" -Q "SELECT 1"`, 'sqlcmd -S localhost -U egdbuser -Q "SELECT @@VERSION"'],
        flag_condition: 'output_contains',
        flag_trigger: '(1 rows affected)|Login failed|Error|Cannot connect|@@VERSION',
        hints: [
          { tier: 1, cost: 10, text: 'Use sqlcmd to test the connection with eG credentials.' },
          { tier: 2, cost: 20, text: `sqlcmd -S ${inputs.db_host || 'localhost'} -U egdbuser -P <password> -Q "SELECT 1"` },
          { tier: 3, cost: 30, text: '"Login failed for user" → reset the egdbuser password in SSMS. "(1 rows affected)" → credentials OK, problem is elsewhere.' },
        ],
        answer_explanation: 'sqlcmd directly tests the SQL Server connection. If login fails, reset the password in SSMS and update /opt/egurkha/manager/config/DBConfig.xml.',
      },
      {
        sequence: 4, title: 'Update eG DB config and restart Manager', type: 'terminal', points: 30,
        description: 'After fixing the DB credentials or connectivity, update the eG Manager DB config file and restart the Manager.',
        expected_commands: ['cat /opt/egurkha/manager/config/DBConfig.xml', 'systemctl restart egurkha', 'systemctl status egurkha'],
        flag_condition: 'output_contains',
        flag_trigger: 'active (running)|Manager started|DBConfig|password|egdbuser',
        hints: [
          { tier: 1, cost: 10, text: 'The DB config is in /opt/egurkha/manager/config/DBConfig.xml' },
          { tier: 2, cost: 20, text: 'Edit DBConfig.xml: update <password> and <dbHost> if needed. Then: systemctl restart egurkha' },
          { tier: 3, cost: 30, text: 'nano /opt/egurkha/manager/config/DBConfig.xml → update credentials → systemctl restart egurkha → check logs for "Database connection established".' },
        ],
        answer_explanation: 'DBConfig.xml stores the eG Manager database connection settings. Update the password field to match the corrected SQL Server password, then restart.',
      },
    ],
  },

  ssl_cert_expired: {
    title:       'Troubleshoot: eG Manager — SSL Certificate Expired',
    description: 'Users are seeing SSL certificate errors when accessing the eG Manager console. Investigate, identify the expired certificate, and renew it.',
    difficulty:  'hard',
    category:    'troubleshooting',
    taskTemplates: (inputs) => [
      {
        sequence: 1, title: 'Check certificate expiry date', type: 'terminal', points: 25,
        description: 'Use OpenSSL to inspect the current certificate installed on the eG Manager and identify the expiry date.',
        expected_commands: ['openssl s_client -connect localhost:443 -showcerts </dev/null 2>/dev/null | openssl x509 -noout -dates', 'openssl x509 -in /opt/egurkha/manager/conf/server.crt -noout -dates'],
        flag_condition: 'output_contains',
        flag_trigger: 'notAfter|Expire|expired|Not After',
        hints: [
          { tier: 1, cost: 10, text: 'Use openssl to check certificate dates.' },
          { tier: 2, cost: 20, text: 'openssl s_client -connect localhost:443 </dev/null | openssl x509 -noout -dates' },
          { tier: 3, cost: 30, text: 'openssl x509 -in /opt/egurkha/manager/conf/server.crt -noout -dates — notBefore and notAfter show validity window.' },
        ],
        answer_explanation: 'notAfter shows the certificate expiry date. If it is in the past, HTTPS connections will be rejected by browsers and agents configured for SSL.',
      },
      {
        sequence: 2, title: 'Generate a new self-signed certificate', type: 'terminal', points: 25,
        description: 'Generate a new self-signed certificate for the eG Manager host (valid for 365 days).',
        expected_commands: ['openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /opt/egurkha/manager/conf/server.key -out /opt/egurkha/manager/conf/server.crt', 'openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes'],
        flag_condition: 'output_contains',
        flag_trigger: 'writing RSA key|Generating|BEGIN CERTIFICATE|server.crt',
        hints: [
          { tier: 1, cost: 10, text: 'Use openssl req -x509 to generate a self-signed certificate.' },
          { tier: 2, cost: 20, text: 'openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt' },
          { tier: 3, cost: 30, text: 'Add -subj "/CN=eg-manager/O=eG Innovations" to skip interactive prompts. Put the files in /opt/egurkha/manager/conf/' },
        ],
        answer_explanation: 'openssl req -x509 generates a self-signed cert. In production, use a CA-signed certificate. The -nodes flag skips passphrase (required for Tomcat auto-start).',
      },
      {
        sequence: 3, title: 'Update Tomcat SSL configuration', type: 'terminal', points: 25,
        description: 'Configure Tomcat server.xml to use the new certificate file. The config is at /opt/egurkha/manager/conf/server.xml.',
        expected_commands: ['cat /opt/egurkha/manager/conf/server.xml', 'grep -i "ssl\\|certificate\\|keystoreFile" /opt/egurkha/manager/conf/server.xml'],
        flag_condition: 'output_contains',
        flag_trigger: 'SSLCertificateFile|keystoreFile|SSL|connector|8443|443',
        hints: [
          { tier: 1, cost: 10, text: 'The Tomcat SSL config is in server.xml.' },
          { tier: 2, cost: 20, text: 'cat /opt/egurkha/manager/conf/server.xml | grep -A5 "SSL"' },
          { tier: 3, cost: 30, text: 'Find the <Connector> element with SSLCertificateFile or keystoreFile attribute — update it to point to your new cert.' },
        ],
        answer_explanation: 'Tomcat reads SSL cert path from server.xml. Update the SSLCertificateFile/SSLCertificateKeyFile attributes, save, and restart.',
      },
      {
        sequence: 4, title: 'Restart Manager and verify HTTPS', type: 'terminal', points: 25,
        description: 'Restart eG Manager and confirm HTTPS is working with the new certificate.',
        expected_commands: ['systemctl restart egurkha', 'curl -k -I https://localhost:443/eg', 'openssl s_client -connect localhost:443 </dev/null 2>/dev/null | openssl x509 -noout -dates'],
        flag_condition: 'output_contains',
        flag_trigger: '200 OK|302 Found|notAfter.*2025|HTTP/1.1',
        hints: [
          { tier: 1, cost: 10, text: 'Restart eG then test HTTPS with curl -k.' },
          { tier: 2, cost: 20, text: 'systemctl restart egurkha && curl -k -I https://localhost:443/eg' },
          { tier: 3, cost: 30, text: 'curl -k skips certificate validation for testing. HTTP 200 or 302 confirms Tomcat is serving HTTPS with the new cert.' },
        ],
        answer_explanation: 'After restart, curl -k -I https://localhost/eg should return HTTP 200 or 302. The -k flag accepts self-signed certs. Re-run the openssl dates check to confirm the new expiry.',
      },
    ],
  },

  log_analysis: {
    title:       'Log Analysis: Diagnose from eG Logs',
    description: 'A set of eG Enterprise logs have been collected. Analyse them to identify the root cause of the reported issue and submit your findings as a flag.',
    difficulty:  'hard',
    category:    'troubleshooting',
    taskTemplates: (inputs) => [
      {
        sequence: 1, title: 'Identify the first error in the log', type: 'terminal', points: 30,
        description: `Logs are at ${inputs.os === 'linux' ? '/var/log/egurkha/' : 'C:\\eGurkha\\logs\\'}\nFind the first ERROR or FATAL level entry and note the timestamp and error message.`,
        expected_commands: ['grep -m5 -E "ERROR|FATAL" /var/log/egurkha/egurkha.log', 'grep -n "ERROR\\|FATAL" /var/log/egurkha/egurkha.log | head -10'],
        flag_condition: 'output_contains',
        flag_trigger: 'ERROR|FATAL|Exception|error|failed',
        hints: [
          { tier: 1, cost: 10, text: 'Use grep to filter ERROR and FATAL lines.' },
          { tier: 2, cost: 20, text: 'grep -E "ERROR|FATAL" /var/log/egurkha/egurkha.log | head -10' },
          { tier: 3, cost: 30, text: 'grep -m 5 "ERROR\\|FATAL" /var/log/egurkha/egurkha.log — -m 5 stops after 5 matches. Note the line number with -n.' },
        ],
        answer_explanation: 'Always start log analysis with the first error, not the most recent. Later errors are often cascading effects of the original failure.',
      },
      {
        sequence: 2, title: 'Trace the error to its root component', type: 'terminal', points: 30,
        description: 'Identify which eG component generated the error (Manager, Agent, DB connector, or specific monitor type) by analysing the log prefix.',
        expected_commands: ['grep -B5 "ERROR" /var/log/egurkha/egurkha.log | head -30', 'awk "/ERROR/{found=1} found{print; if(++count==10) exit}" /var/log/egurkha/egurkha.log'],
        flag_condition: 'output_contains',
        flag_trigger: 'Manager|Agent|Monitor|Connector|Thread|Class|com.eg',
        hints: [
          { tier: 1, cost: 10, text: 'Use grep -B to see lines before the error for context.' },
          { tier: 2, cost: 20, text: 'grep -B5 "ERROR" egurkha.log — -B5 shows 5 lines before each ERROR.' },
          { tier: 3, cost: 30, text: 'The Java class name in the log (e.g. com.eg.manager.db.DBConnector) identifies exactly which component failed.' },
        ],
        answer_explanation: 'eG logs include the Java class name. com.eg.manager.* is Manager-side, com.eg.agent.* is Agent-side. The class name pinpoints the failed component.',
      },
      {
        sequence: 3, title: 'Identify the fix and submit as flag', type: 'flag_submit', points: 40,
        description: 'Based on your log analysis, identify the root cause and the correct fix. Submit the flag that corresponds to your diagnosis.\n\nAvailable flags:\n  eGSIM{db_connection_timeout} — Database connection timed out\n  eGSIM{agent_config_wrong}   — Agent misconfigured\n  eGSIM{port_blocked}         — Firewall blocking port\n  eGSIM{cert_expired}         — SSL certificate expired\n  eGSIM{service_crashed}      — eG service crashed (OOM)',
        flag_condition: 'output_contains',
        flag_trigger: 'eGSIM{',
        hints: [
          { tier: 1, cost: 10, text: 'Look at the exception type in the logs: SocketTimeoutException → db_connection_timeout.' },
          { tier: 2, cost: 20, text: 'SQLException with "Login failed" → db_connection_timeout. SSLHandshakeException → cert_expired. ConnectException → port_blocked.' },
          { tier: 3, cost: 30, text: 'OutOfMemoryError in logs → service_crashed. ConfigurationException → agent_config_wrong.' },
        ],
        answer_explanation: 'Log analysis maps exception types to root causes. This skill — reading stack traces to identify the original failure — is the most valuable troubleshooting skill for eG admins.',
      },
    ],
  },
};

// ── Input validation ──────────────────────────────────────────
const VALID_SCENARIO_TYPES = Object.keys(SCENARIO_TEMPLATES);
const VALID_OS = ['linux', 'windows'];

function validateInputs(inputs) {
  const errors = [];
  if (!inputs.scenario_type)  errors.push('scenario_type is required');
  if (!inputs.os)             errors.push('os is required (linux or windows)');
  if (inputs.scenario_type && !VALID_SCENARIO_TYPES.includes(inputs.scenario_type) && inputs.scenario_type !== 'custom') {
    errors.push(`Invalid scenario_type. Valid: ${VALID_SCENARIO_TYPES.join(', ')}, custom`);
  }
  if (inputs.os && !VALID_OS.includes(inputs.os)) {
    errors.push('os must be linux or windows');
  }
  return errors;
}

// ── Generate YAML from template ────────────────────────────────
function buildRoomYaml(inputs, template, roomSlug) {
  const tasks = template.taskTemplates(inputs);
  const room  = {
    id:          roomSlug,
    title:       inputs.title || template.title,
    description: inputs.description || template.description,
    os:          inputs.os,
    difficulty:  inputs.difficulty || template.difficulty || 'medium',
    category:    template.category,
    component_type: inputs.component_type || 'eG Manager',
    phase:       6,
    estimated_minutes: inputs.estimated_minutes || 45,
    docker_image: inputs.os === 'windows' ? 'eg-sim-windows-sim:latest' : 'eg-sim-linux-lab:latest',
    tasks,
  };
  return yaml.dump(room, { lineWidth: 120 });
}

// ── Main generator function ────────────────────────────────────
async function generateTroubleshootingLab(inputs, authorId) {
  const errors = validateInputs(inputs);
  if (errors.length) throw new Error(`Validation failed: ${errors.join('; ')}`);

  const template = SCENARIO_TEMPLATES[inputs.scenario_type];
  if (!template && inputs.scenario_type !== 'custom') {
    throw new Error(`Template not found for scenario_type: ${inputs.scenario_type}`);
  }

  const roomSlug  = `dynamic-${inputs.scenario_type}-${inputs.os}-${Date.now()}`;
  const yamlText  = inputs.scenario_type === 'custom'
    ? inputs.custom_yaml
    : buildRoomYaml(inputs, template, roomSlug);

  // Compute total points
  const tasks      = inputs.scenario_type === 'custom'
    ? []
    : template.taskTemplates(inputs);
  const pointsTotal = tasks.reduce((s, t) => s + (t.points || 0), 0);

  // Insert into DB
  const { rows } = await db.query(
    `INSERT INTO rooms
       (slug, title, description, os, difficulty, status, phase, category,
        component_type, yaml_definition, points_total, estimated_minutes,
        docker_image, author_id)
     VALUES ($1,$2,$3,$4,$5,'draft',6,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, slug, title`,
    [
      roomSlug,
      inputs.title || template?.title || roomSlug,
      inputs.description || template?.description || '',
      inputs.os,
      inputs.difficulty || template?.difficulty || 'medium',
      'troubleshooting',
      inputs.component_type || 'eG Manager',
      yamlText,
      pointsTotal,
      inputs.estimated_minutes || 45,
      inputs.os === 'windows' ? 'eg-sim-windows-sim:latest' : 'eg-sim-linux-lab:latest',
      authorId,
    ]
  );

  // Insert tasks
  if (tasks.length) {
    for (const task of tasks) {
      await db.query(
        `INSERT INTO tasks
           (room_id, sequence, title, description, task_type, points,
            hint_1, hint_1_cost, hint_2, hint_2_cost, hint_3, hint_3_cost, answer_explanation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          rows[0].id, task.sequence, task.title, task.description,
          task.type || 'terminal', task.points || 20,
          task.hints?.[0]?.text, task.hints?.[0]?.cost || 10,
          task.hints?.[1]?.text, task.hints?.[1]?.cost || 20,
          task.hints?.[2]?.text, task.hints?.[2]?.cost || 30,
          task.answer_explanation || '',
        ]
      );
    }
  }

  logger.info('Dynamic troubleshooting lab generated', {
    roomSlug, scenario: inputs.scenario_type, os: inputs.os, authorId,
  });

  return { room: rows[0], yamlText, taskCount: tasks.length };
}

module.exports = {
  generateTroubleshootingLab,
  VALID_SCENARIO_TYPES,
  SCENARIO_TEMPLATES,
};
