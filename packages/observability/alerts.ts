/*
 * @career-builder/observability — Alerting System
 *
 * Trigger alerts on:
 *   - High error rate (> threshold in time window)
 *   - API latency spikes (p95 > threshold)
 *   - Failed login bursts (brute force indicator)
 *   - Unusual traffic patterns (anomaly detection feeds in)
 *
 * Integrations:
 *   - Slack webhook
 *   - Email (via SMTP or external service)
 *   - Console fallback (always on)
 *
 * Anti-spam: Alert deduplication with cooldown periods.
 */

import { getLogger, type LogEntry } from "./logger";

const logger = getLogger("alerting");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  context: Record<string, unknown>;
  timestamp: string;
  source: string;
}

export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

export interface AlertRuleConfig {
  /** Unique rule identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** How often to evaluate this rule (ms) */
  evaluationIntervalMs: number;
  /** Minimum time between alerts for this rule (ms) */
  cooldownMs: number;
  /** Severity of the alert */
  severity: AlertSeverity;
  /** Evaluation function — return an alert message if triggered, null otherwise */
  evaluate: () => string | null;
}

/* ================================================================== */
/*  Alert Channels                                                     */
/* ================================================================== */

/** Console channel (always available, great for development). */
export class ConsoleAlertChannel implements AlertChannel {
  name = "console";

  async send(alert: Alert): Promise<void> {
    const icon =
      alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";
    console.log(
      `${icon} [ALERT:${alert.severity.toUpperCase()}] ${alert.title} — ${alert.description}`,
    );
    logger.warn("alert_fired", {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
    });
  }
}

/** Slack webhook channel. */
export class SlackAlertChannel implements AlertChannel {
  name = "slack";
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(alert: Alert): Promise<void> {
    const icon =
      alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";

    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${icon} *[${alert.severity.toUpperCase()}]* ${alert.title}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `${icon} *${alert.title}*`,
                  alert.description,
                  `*Severity:* ${alert.severity}`,
                  `*Source:* ${alert.source}`,
                  `*Time:* ${alert.timestamp}`,
                  Object.keys(alert.context).length > 0
                    ? `*Context:* \`${JSON.stringify(alert.context)}\``
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            },
          ],
        }),
      });
    } catch (err) {
      logger.error("slack_alert_failed", { error: String(err) });
    }
  }
}

/** Email alert channel (uses a generic POST endpoint — plug in SendGrid / SES / etc.). */
export class EmailAlertChannel implements AlertChannel {
  name = "email";
  private endpoint: string;
  private to: string;
  private from: string;

  constructor(config: { endpoint: string; to: string; from: string }) {
    this.endpoint = config.endpoint;
    this.to = config.to;
    this.from = config.from;
  }

  async send(alert: Alert): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: this.to,
          from: this.from,
          subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          body: [
            alert.description,
            "",
            `Severity: ${alert.severity}`,
            `Source: ${alert.source}`,
            `Time: ${alert.timestamp}`,
            "",
            `Context: ${JSON.stringify(alert.context, null, 2)}`,
          ].join("\n"),
        }),
      });
    } catch (err) {
      logger.error("email_alert_failed", { error: String(err) });
    }
  }
}

/**
 * Database persistence channel — stores every alert in a persistent store.
 *
 * The observability package is database-agnostic, so we accept a `persist`
 * callback. The app layer provides the actual DB write (e.g., Prisma).
 *
 * Usage in the app:
 * ```ts
 * import { alertManager, DatabaseAlertChannel } from "@career-builder/observability";
 * import { prisma } from "@career-builder/database";
 *
 * alertManager.addChannel(new DatabaseAlertChannel(async (alert) => {
 *   await prisma.auditLog.create({
 *     data: {
 *       action: `alert:${alert.severity}`,
 *       entity: "system",
 *       entityId: alert.id,
 *       details: JSON.stringify({ title: alert.title, description: alert.description, context: alert.context, source: alert.source }),
 *       tenantId: "default",
 *     },
 *   });
 * }));
 * ```
 */
export class DatabaseAlertChannel implements AlertChannel {
  name = "database";
  private persist: (alert: Alert) => Promise<void>;

  constructor(persist: (alert: Alert) => Promise<void>) {
    this.persist = persist;
  }

  async send(alert: Alert): Promise<void> {
    try {
      await this.persist(alert);
    } catch (err) {
      // Never let a DB failure crash the alert pipeline
      logger.error("db_alert_persist_failed", {
        alertId: alert.id,
        error: String(err),
      });
    }
  }
}

/* ================================================================== */
/*  Alert Manager                                                      */
/* ================================================================== */

export class AlertManager {
  private channels: AlertChannel[] = [];
  private severityChannels = new Map<AlertSeverity, AlertChannel[]>();
  private rules: AlertRuleConfig[] = [];
  private lastAlertTime = new Map<string, number>();
  private intervals: ReturnType<typeof setInterval>[] = [];
  private alertHistory: Alert[] = [];
  private maxHistory = 500;

  constructor() {
    // Console is always on for all severities
    this.channels.push(new ConsoleAlertChannel());
  }

  /** Add an alert channel (receives all severities). */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Add a channel that only receives specific severity levels.
   * Example: route critical alerts to Slack, warnings to logs only.
   *
   * ```ts
   * alertManager.addChannelForSeverity("critical", new SlackAlertChannel(url));
   * ```
   */
  addChannelForSeverity(severity: AlertSeverity, channel: AlertChannel): void {
    let list = this.severityChannels.get(severity);
    if (!list) {
      list = [];
      this.severityChannels.set(severity, list);
    }
    list.push(channel);
  }

  /** Register an alerting rule. */
  addRule(rule: AlertRuleConfig): void {
    this.rules.push(rule);

    const interval = setInterval(() => {
      this.evaluateRule(rule);
    }, rule.evaluationIntervalMs);

    if (interval.unref) interval.unref();
    this.intervals.push(interval);
  }

  /** Fire an alert manually. */
  async fire(
    severity: AlertSeverity,
    title: string,
    description: string,
    context: Record<string, unknown> = {},
    source = "manual",
  ): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      severity,
      title,
      description,
      context,
      timestamp: new Date().toISOString(),
      source,
    };

    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistory);
    }

    // Send to global channels (always)
    const targets = [...this.channels];

    // Add severity-specific channels
    const severityTargets = this.severityChannels.get(alert.severity);
    if (severityTargets) {
      targets.push(...severityTargets);
    }

    await Promise.allSettled(targets.map((ch) => ch.send(alert)));
  }

  /** Get recent alert history. */
  getHistory(limit = 50): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /** Hook into the logger to watch for errors. */
  watchLogger(loggerInstance: { onLog: (fn: (entry: LogEntry) => void) => () => void }): () => void {
    return loggerInstance.onLog((entry) => {
      if (entry.level === "error" || entry.level === "fatal") {
        // Don't alert on every error — anomaly detector handles bursts
        // But do track for the error-rate alerting rule
      }
    });
  }

  private async evaluateRule(rule: AlertRuleConfig): Promise<void> {
    const now = Date.now();
    const lastFired = this.lastAlertTime.get(rule.id) ?? 0;

    // Cooldown check
    if (now - lastFired < rule.cooldownMs) return;

    const message = rule.evaluate();
    if (message) {
      this.lastAlertTime.set(rule.id, now);
      await this.fire(
        rule.severity,
        rule.description,
        message,
        { ruleId: rule.id },
        `rule:${rule.id}`,
      );
    }
  }

  /** Cleanup all intervals. */
  destroy(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }
}

/* ================================================================== */
/*  Singleton                                                          */
/* ================================================================== */

const globalForAlerts = globalThis as unknown as {
  __cbAlertManager?: AlertManager;
};

if (!globalForAlerts.__cbAlertManager) {
  globalForAlerts.__cbAlertManager = new AlertManager();
}

export const alertManager: AlertManager = globalForAlerts.__cbAlertManager!;
