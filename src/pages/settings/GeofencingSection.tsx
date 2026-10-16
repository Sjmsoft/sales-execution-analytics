import { useState, useEffect } from "react";
import {
  Compass,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Sliders,
  Radio,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Crosshair,
  Check,
} from "lucide-react";
import {
  type GeofenceProviderId,
  type GeofenceEnforcementMode,
  type GeofenceIntegrationConfig,
  getGeofenceConfig,
  saveGeofenceConfig,
  testProviderConnection,
  syncOutletsToGeofenceProvider,
  PROVIDER_METADATA,
  type ProviderConnectionTestResult,
  calculateHaversineDistance,
} from "../../services/geofencingIntegrationService";
import { getOutlets, type Outlet } from "../../services/referenceService";

export function GeofencingSection() {
  const [config, setConfig] = useState<GeofenceIntegrationConfig>(() => getGeofenceConfig());
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  // Connection Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);

  // Outlets Sync state
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Live Simulator state
  const [simLat, setSimLat] = useState("6.5244");
  const [simLng, setSimLng] = useState("3.3792");
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [simResult, setSimResult] = useState<{
    distance: number;
    inPerimeter: boolean;
    provider: string;
    action: string;
  } | null>(null);

  useEffect(() => {
    void getOutlets().then((data) => {
      setOutlets(data);
      if (data.length > 0) {
        setSelectedOutletId(data[0].id);
      }
    });
  }, []);

  const handleUpdate = (updates: Partial<GeofenceIntegrationConfig>) => {
    const updated = saveGeofenceConfig(updates);
    setConfig(updated);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testProviderConnection(config.provider, config.apiKey, config.environment);
      setTestResult(res);
    } catch {
      setTestResult({
        success: false,
        provider: config.provider,
        latencyMs: 0,
        message: "Failed to establish connection to geofence endpoint.",
        details: { status: "Error", environment: config.environment, endpoint: "", features: [] },
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncOutlets = async () => {
    setSyncing(true);
    setSyncSuccessMessage(null);
    try {
      const res = await syncOutletsToGeofenceProvider(outlets);
      setSyncSuccessMessage(
        `Successfully synced ${res.syncedCount} retail outlet geofences to ${PROVIDER_METADATA[config.provider].name}.`,
      );
      setConfig(getGeofenceConfig());
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncSuccessMessage(null), 5000);
    }
  };

  const handleRunSimulation = () => {
    const targetOutlet = outlets.find((o) => o.id === selectedOutletId) || outlets[0];
    if (!targetOutlet || !targetOutlet.gpslatitude || !targetOutlet.gpslongitude) return;

    const uCoords = { latitude: Number(simLat), longitude: Number(simLng) };
    const oCoords = { latitude: Number(targetOutlet.gpslatitude), longitude: Number(targetOutlet.gpslongitude) };

    const dist = calculateHaversineDistance(uCoords, oCoords);
    const inPerimeter = dist <= config.defaultRadiusMeters;

    let action = "";
    if (inPerimeter) {
      action = "✅ Check-in Allowed (Within Authorized Geofence)";
    } else if (config.enforcementMode === "warning") {
      action = "⚠️ Outside Geofence — Allowed ONLY with Mandatory Justification Reason";
    } else if (config.enforcementMode === "audit") {
      action = "ℹ️ Check-in Permitted & Flagged for Supervisor Audit";
    } else {
      action = "🚫 Check-in Strictly Blocked by Geofence Lock";
    }

    setSimResult({
      distance: dist,
      inPerimeter,
      provider: PROVIDER_METADATA[config.provider].name,
      action,
    });
  };

  const activeMeta = PROVIDER_METADATA[config.provider] || PROVIDER_METADATA.radar;

  const RADIUS_PRESETS = [50, 100, 200, 500, 1000];

  return (
    <div className="geofence-settings-container">
      {/* ── Header ── */}
      <div className="settings-section-titles" style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #064e3b 0%, #0284c7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                }}
              >
                <Compass size={22} />
              </div>
              <div>
                <h3 className="settings-section-title" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
                  Geofencing & 3rd-Party Location Integrations
                </h3>
                <p className="settings-section-subtitle" style={{ margin: 0 }}>
                  Configure enterprise geofence providers (Radar.io, Google Maps, Mapbox) and Jibble-style enforcement rules.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveStatus === "saved" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#059669",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Check size={14} /> Saved & Synced
              </span>
            )}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#0284c7",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Zap size={13} /> Active Provider: {activeMeta.name}
            </span>
          </div>
        </div>
      </div>

      {/* ── Provider Cards Selector ── */}
      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Select 3rd-Party Geofencing Provider
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {(Object.keys(PROVIDER_METADATA) as GeofenceProviderId[]).map((key) => {
            const meta = PROVIDER_METADATA[key];
            const isSelected = config.provider === key;
            return (
              <div
                key={key}
                onClick={() => handleUpdate({ provider: key })}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: isSelected ? `2px solid ${meta.badgeColor}` : "1px solid #e2e8f0",
                  background: isSelected ? "#ffffff" : "#f8fafc",
                  boxShadow: isSelected ? `0 8px 24px -6px ${meta.badgeColor}33` : "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <strong style={{ fontSize: 15, color: "#0f172a" }}>{meta.name}</strong>
                    {key === "radar" && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 10 }}>
                        Jibble Benchmark
                      </span>
                    )}
                    {isSelected && <CheckCircle2 size={18} color={meta.badgeColor} />}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: meta.badgeColor, display: "block", marginBottom: 8 }}>
                    {meta.tagline}
                  </span>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px 0", lineHeight: 1.4 }}>
                    {meta.description}
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {meta.features.slice(0, 2).map((feat, i) => (
                    <span key={i} style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: 4 }}>
                      • {feat}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── API Credentials & Environment ── */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 22, marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={18} color="#0f172a" />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              {activeMeta.name} API Credentials
            </h4>
          </div>
          {activeMeta.docsUrl && (
            <a
              href={activeMeta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontWeight: 600 }}
            >
              Provider API Documentation <ExternalLink size={12} />
            </a>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 18 }}>
          {/* API Key */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
              {config.provider === "radar" ? "Publishable Key (Client)" : "API Key / Access Token"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                placeholder={activeMeta.keyPlaceholder}
                disabled={config.provider === "native"}
                onChange={(e) => handleUpdate({ apiKey: e.target.value })}
                style={{
                  width: "100%",
                  height: 42,
                  padding: "0 38px 0 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontFamily: "monospace",
                  background: config.provider === "native" ? "#f8fafc" : "#ffffff",
                }}
              />
              {config.provider !== "native" && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: "absolute", right: 10, top: 12, background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            <small style={{ color: "#64748b", fontSize: 11, marginTop: 4, display: "block" }}>
              {config.provider === "radar"
                ? "Accepts prj_live_pk_... (Live) or prj_test_pk_... (Sandbox)."
                : config.provider === "native"
                ? "Native hardware GNSS operates automatically with zero configuration."
                : "Used to verify perimeter and distance with the provider."}
            </small>
          </div>

          {/* Secret Key (Radar optional) */}
          {activeMeta.requiresSecret && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                Secret Key (Server-to-Server Geofence Sync)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showSecret ? "text" : "password"}
                  value={config.secretKey || ""}
                  placeholder="prj_live_sk_..."
                  onChange={(e) => handleUpdate({ secretKey: e.target.value })}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 38px 0 12px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  style={{ position: "absolute", right: 10, top: 12, background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small style={{ color: "#64748b", fontSize: 11, marginTop: 4, display: "block" }}>
                Required for bulk cloud polygon syncing.
              </small>
            </div>
          )}

          {/* Environment */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
              Integration Environment
            </label>
            <div style={{ display: "flex", gap: 10, height: 42 }}>
              <button
                type="button"
                onClick={() => handleUpdate({ environment: "production" })}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  border: config.environment === "production" ? "2px solid #059669" : "1px solid #cbd5e1",
                  background: config.environment === "production" ? "#ecfdf5" : "#ffffff",
                  color: config.environment === "production" ? "#065f46" : "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Production Mode
              </button>
              <button
                type="button"
                onClick={() => handleUpdate({ environment: "test" })}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  border: config.environment === "test" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                  background: config.environment === "test" ? "#f0f9ff" : "#ffffff",
                  color: config.environment === "test" ? "#0369a1" : "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Test / Sandbox
              </button>
            </div>
          </div>
        </div>

        {/* Action: Ping Test Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RefreshCw size={14} className={testing ? "spin" : ""} />
            {testing ? "Pinging Provider API..." : "Test Provider Connection & Ping"}
          </button>

          {testResult && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 10,
                background: testResult.success ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${testResult.success ? "#a7f3d0" : "#fecaca"}`,
                fontSize: 12,
                color: testResult.success ? "#065f46" : "#991b1b",
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{testResult.message}</span>
              {testResult.latencyMs > 0 && <strong>({testResult.latencyMs}ms)</strong>}
            </div>
          )}
        </div>
      </div>

      {/* ── Jibble-Style Geofence Policy & Restrictions ── */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 22, marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Sliders size={18} color="#0f172a" />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            Jibble-Style Geofence Enforcement & Proximity Rules
          </h4>
        </div>

        {/* 1. Radius Configuration */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
            Default Geofence Perimeter Radius
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            {RADIUS_PRESETS.map((rad) => {
              const active = config.defaultRadiusMeters === rad;
              return (
                <button
                  key={rad}
                  type="button"
                  onClick={() => handleUpdate({ defaultRadiusMeters: rad })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: active ? "2px solid #059669" : "1px solid #cbd5e1",
                    background: active ? "#ecfdf5" : "#ffffff",
                    color: active ? "#065f46" : "#334155",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {rad} meters {rad === 500 && "(Retail Standard)"}
                </button>
              );
            })}

            {/* Custom Radius input */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min="20"
                max="5000"
                value={config.defaultRadiusMeters}
                onChange={(e) => handleUpdate({ defaultRadiusMeters: Math.max(20, Number(e.target.value) || 100) })}
                style={{
                  width: 90,
                  height: 36,
                  padding: "0 8px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>meters custom</span>
            </div>
          </div>
          <small style={{ color: "#64748b", fontSize: 12 }}>
            Represents the maximum allowable distance between a field rep's verified device coordinates and the retail outlet.
          </small>
        </div>

        {/* 2. Enforcement Mode (Jibble Policy) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
            Enforcement Restriction Policy
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              {
                mode: "strict" as GeofenceEnforcementMode,
                title: "Strict Geofence Lock",
                tag: "Recommended for BAs",
                desc: "Reps CANNOT clock in or record visit unless physically inside the authorized perimeter.",
                color: "#dc2626",
              },
              {
                mode: "warning" as GeofenceEnforcementMode,
                title: "Warning + Justification",
                tag: "Jibble Flexible Mode",
                desc: "Permits off-site check-in but requires reps to provide a mandatory justification reason logged for supervisors.",
                color: "#d97706",
              },
              {
                mode: "audit" as GeofenceEnforcementMode,
                title: "Audit Only",
                tag: "Passive Logging",
                desc: "Never blocks the rep; records distance and GPS tags strictly for compliance and territory reporting.",
                color: "#059669",
              },
            ].map((p) => {
              const selected = config.enforcementMode === p.mode;
              return (
                <div
                  key={p.mode}
                  onClick={() => handleUpdate({ enforcementMode: p.mode })}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: selected ? `2px solid ${p.color}` : "1px solid #e2e8f0",
                    background: selected ? "#ffffff" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: 14, color: "#0f172a" }}>{p.title}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                      {p.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.35 }}>{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Anti-Spoofing & Mock Location Detection */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ maxWidth: 600 }}>
              <strong style={{ fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={16} color="#059669" /> Anti-Spoofing & Mock Location Guard
              </strong>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                Detects simulated GPS, mock location apps (e.g. Fake GPS / Android Developer Options), and flags suspicious jumps.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.requireMockLocationCheck}
              onClick={() => handleUpdate({ requireMockLocationCheck: !config.requireMockLocationCheck })}
              className={`settings-toggle${config.requireMockLocationCheck ? " settings-toggle--on" : ""}`}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <strong style={{ fontSize: 13, color: "#0f172a" }}>Maximum Allowable GPS Accuracy Threshold</strong>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                Rejects GPS coordinates if device signal accuracy is worse than this threshold (mitigates indoor drift).
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="20"
                max="500"
                value={config.maxAllowableAccuracyMeters}
                onChange={(e) => handleUpdate({ maxAllowableAccuracyMeters: Number(e.target.value) || 120 })}
                style={{
                  width: 80,
                  height: 36,
                  padding: "0 8px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>meters</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Outlet Geofence Syncing & Cloud Database ── */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 22, marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Radio size={18} color="#0284c7" />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Outlet Geofence Directory Sync
              </h4>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
              Publish registered retail outlet coordinates to {activeMeta.name} for automatic boundary tracking and trip notifications.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncOutlets}
            disabled={syncing}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              background: "#0284c7",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RefreshCw size={14} className={syncing ? "spin" : ""} />
            {syncing ? "Syncing Geofences..." : `Sync ${outlets.length} Outlets to ${activeMeta.name}`}
          </button>
        </div>

        {syncSuccessMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            {syncSuccessMessage}
          </div>
        )}

        {config.lastSyncAt && (
          <small style={{ color: "#64748b", fontSize: 11 }}>
            Last cloud synchronization: {new Date(config.lastSyncAt).toLocaleString("en-NG")}
          </small>
        )}
      </div>

      {/* ── Interactive Geofence Live Simulator (Jibble-Style Verification Test) ── */}
      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Crosshair size={18} color="#0f172a" />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            Geofence Diagnostic Simulator
          </h4>
        </div>
        <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "#64748b" }}>
          Simulate a staff member's position relative to any outlet to preview the exact 3rd-party verification response.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
              Target Retail Outlet
            </label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 13 }}
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.gpslatitude ? `(${Number(o.gpslatitude).toFixed(3)}, ${Number(o.gpslongitude).toFixed(3)})` : "(No GPS)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
              Simulated Staff Latitude
            </label>
            <input
              type="text"
              value={simLat}
              onChange={(e) => setSimLat(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
              Simulated Staff Longitude
            </label>
            <input
              type="text"
              value={simLng}
              onChange={(e) => setSimLng(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              onClick={handleRunSimulation}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 8,
                background: "#059669",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Compass size={15} /> Run Diagnostic Check
            </button>
          </div>
        </div>

        {simResult && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: simResult.inPerimeter ? "#ecfdf5" : "#fffbeb",
              border: `1px solid ${simResult.inPerimeter ? "#a7f3d0" : "#fde68a"}`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14, color: simResult.inPerimeter ? "#065f46" : "#92400e" }}>
                {simResult.action}
              </strong>
              <span style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: 10 }}>
                {simResult.provider}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#475569" }}>
              Measured Distance: <strong>{simResult.distance} meters</strong> &bull; Allowed Perimeter:{" "}
              <strong>{config.defaultRadiusMeters} meters</strong> &bull; Enforcement Mode:{" "}
              <strong style={{ textTransform: "capitalize" }}>{config.enforcementMode}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
