import { useState } from 'react';
import { BookOpen, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * DocPanel — embedded eG Enterprise documentation reference
 * Shown inside the lab room as a collapsible side panel.
 * Content is keyed by category + component_type from the room config.
 */

const DOC_SECTIONS = {
  prerequisites: {
    title: 'Prerequisites Reference',
    sections: [
      {
        heading: 'eG Manager — Minimum Requirements',
        content: [
          { label: 'OS (Linux)',    value: 'RHEL/CentOS 7-8, Ubuntu 20.04/22.04 LTS' },
          { label: 'OS (Windows)', value: 'Windows Server 2016, 2019, 2022 Standard/Datacenter' },
          { label: 'RAM',          value: '8 GB minimum, 16 GB recommended' },
          { label: 'Disk',         value: '50 GB free on install partition' },
          { label: 'Java',         value: 'OpenJDK 11 or 17 (LTS)' },
          { label: 'App Server',   value: 'Apache Tomcat (bundled with eG installer)' },
          { label: 'DB Backend',   value: 'MS SQL Server (Standard/Enterprise) or Oracle DB' },
        ],
      },
      {
        heading: 'eG Agent — Minimum Requirements',
        content: [
          { label: 'RAM',          value: '512 MB minimum (1 GB recommended)' },
          { label: 'Disk',         value: '5 GB free' },
          { label: 'Java',         value: 'OpenJDK 11 or 17 (bundled option available)' },
          { label: 'Network',      value: 'TCP 7077 outbound to eG Manager' },
        ],
      },
      {
        heading: 'Required Network Ports',
        content: [
          { label: '7076',  value: 'eG Manager HTTP (console access)' },
          { label: '7077',  value: 'eG Agent → Manager communication' },
          { label: '443',   value: 'HTTPS (after SSL configuration)' },
          { label: '1433',  value: 'MS SQL Server (eG backend DB)' },
          { label: '1521',  value: 'Oracle DB (if using Oracle backend)' },
        ],
      },
    ],
  },
  installation: {
    title: 'Installation Reference',
    sections: [
      {
        heading: 'Linux Installation Steps',
        content: [
          { label: '1', value: 'Verify all prerequisites (OS, Java, DB, ports)' },
          { label: '2', value: 'Download installer: eGurkha_Manager_x.x_linux.bin' },
          { label: '3', value: 'chmod +x installer.bin' },
          { label: '4', value: 'Set JAVA_HOME: export JAVA_HOME=$(readlink -f /usr/bin/java | sed \'s:/bin/java::\')'  },
          { label: '5', value: './installer.bin -i console' },
          { label: '6', value: 'Enter DB type (MSSQL/Oracle), host, port, credentials' },
          { label: '7', value: 'Verify: systemctl status egurkha' },
          { label: '8', value: 'Enable on boot: systemctl enable egurkha' },
        ],
      },
      {
        heading: 'Common Installation Errors',
        content: [
          { label: 'JAVA_HOME not set', value: 'export JAVA_HOME before running installer' },
          { label: 'DB connect refused', value: 'Verify SQL Server running + port 1433 open' },
          { label: 'Permission denied',  value: 'Run installer as root or with sudo' },
          { label: 'Port already in use',value: 'Check: ss -tlnp | grep 7076' },
        ],
      },
    ],
  },
  configuration: {
    title: 'Configuration Reference',
    sections: [
      {
        heading: 'eG Manager Console Paths',
        content: [
          { label: 'Login URL',        value: 'http://<host>:7076/eg' },
          { label: 'Default creds',    value: 'admin / admin (change on first login)' },
          { label: 'DB Settings',      value: 'Admin → Database Settings' },
          { label: 'Email/SMTP',       value: 'Admin → Notification → Email Settings' },
          { label: 'Agent Approval',   value: 'Infrastructure → Agents → Pending Agents' },
          { label: 'Thresholds',       value: 'Thresholds → Component Thresholds' },
          { label: 'Alert Rules',      value: 'Alerts → Alert Rules' },
          { label: 'Data Retention',   value: 'Admin → Data Management → Retention Policy' },
        ],
      },
      {
        heading: 'Component Type — Required Permissions',
        content: [
          { label: 'Windows (WMI)',   value: 'Domain account + Performance Monitor Users or local Admin' },
          { label: 'Linux (SSH)',      value: 'Dedicated user + SSH key + limited sudo' },
          { label: 'VMware vCenter',  value: 'Read-Only role at vCenter root level' },
          { label: 'Citrix CVAD',     value: 'Citrix Read-Only Administrator role on Delivery Controller' },
        ],
      },
    ],
  },
  troubleshooting: {
    title: 'Troubleshooting Reference',
    sections: [
      {
        heading: 'Log File Locations',
        content: [
          { label: 'Manager (Linux)',   value: '/opt/egurkha/manager/logs/egurkha.log' },
          { label: 'Manager (Windows)', value: 'C:\\eGurkha\\manager\\logs\\egurkha.log' },
          { label: 'Agent (Linux)',     value: '/opt/egurkha/agent/logs/egurkha.log' },
          { label: 'GC Log (Linux)',    value: '/opt/egurkha/manager/logs/gc.log' },
        ],
      },
      {
        heading: 'Common Errors → Fix',
        content: [
          { label: 'OutOfMemoryError',       value: 'Increase JVM heap: edit startup.sh → -Xmx8g' },
          { label: 'Login failed (DB)',       value: 'Reset egdbuser password in SSMS, update DBConfig.xml' },
          { label: 'Agent disconnect',        value: 'Check manager.host in agent.properties + port 7077 firewall' },
          { label: 'SSL handshake failure',   value: 'Regenerate cert: openssl req -x509 -days 365 ...' },
          { label: 'Console not loading',     value: 'Check service: systemctl status egurkha; check port: ss -tlnp | grep 7076' },
        ],
      },
      {
        heading: 'Key Commands — Linux',
        content: [
          { label: 'Restart Manager',  value: 'systemctl restart egurkha' },
          { label: 'View live logs',   value: 'tail -f /opt/egurkha/manager/logs/egurkha.log' },
          { label: 'Check DB conn',    value: 'sqlcmd -S localhost -U egdbuser -Q "SELECT 1"' },
          { label: 'Port check',       value: 'ss -tlnp | grep -E "7076|7077|1433"' },
        ],
      },
    ],
  },
};

export default function DocPanel({ category, componentType }) {
  const [open,        setOpen]        = useState(true);
  const [expandedSec, setExpandedSec] = useState({});

  const docData  = DOC_SECTIONS[category] || DOC_SECTIONS['configuration'];

  const toggleSec = (idx) => {
    setExpandedSec(s => ({ ...s, [idx]: !s[idx] }));
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
        background: '#161b22', border: '1px solid #30363d',
        borderRight: 'none', borderRadius: '8px 0 0 8px',
        padding: '0.75rem 0.5rem', cursor: 'pointer', color: '#58a6ff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        writingMode: 'vertical-rl',
      }}>
        <BookOpen size={14} />
        <span style={{ fontSize: 11 }}>Docs</span>
      </button>
    );
  }

  return (
    <div style={{
      width: 280, flexShrink: 0, background: '#161b22',
      borderLeft: '1px solid #30363d', display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1rem',
                    borderBottom: '1px solid #30363d', flexShrink: 0 }}>
        <BookOpen size={14} color="#58a6ff" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>
          {docData.title}
        </span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none',
                  color: '#8b949e', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
        {docData.sections.map((sec, idx) => (
          <div key={idx} style={{ marginBottom: '0.5rem' }}>
            <button onClick={() => toggleSec(idx)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '0.4rem 0.5rem', borderRadius: 6, textAlign: 'left',
            }}>
              {expandedSec[idx]
                ? <ChevronDown size={12} color="#8b949e" />
                : <ChevronRight size={12} color="#8b949e" />}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{sec.heading}</span>
            </button>

            {expandedSec[idx] && (
              <div style={{ paddingLeft: '1.25rem', paddingBottom: '0.5rem' }}>
                {sec.content.map((item, i) => (
                  <div key={i} style={{ padding: '0.3rem 0', borderBottom: i < sec.content.length - 1 ? '1px solid #21262d' : 'none' }}>
                    <div style={{ fontSize: 11, color: '#58a6ff', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.4 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <a href="https://docs.eginnovations.com" target="_blank" rel="noopener noreferrer"
           style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#58a6ff',
                    textDecoration: 'none', padding: '0.5rem', marginTop: '0.5rem' }}>
          <ExternalLink size={11} />
          Full eG Enterprise Docs ↗
        </a>
      </div>
    </div>
  );
}
