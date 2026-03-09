"use client";

import type { CSSProperties, ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import type {
  AdvisorSalesReportItem,
  CloseTimeReportItem,
  FunnelReportSummary,
  LeadsByChannelItem,
  LossReasonItem,
  StageConversionReportItem,
} from "@/types/api";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

const pageTheme = {
  "--text": "#10233f",
  "--text-muted": "#5f7188",
  "--border": "#d8e1ea",
} as CSSProperties;

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  padding: "24px",
  borderRadius: 28,
  border: "1px solid #d8e1ea",
  background: "linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%)",
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.12)",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  padding: "20px",
  borderRadius: 20,
  border: "1px solid #d8e1ea",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const splitGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
};

const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#71839a",
};

const valueStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.75rem",
  fontWeight: 700,
  letterSpacing: "-0.04em",
  color: "#10233f",
};

const copyStyle: CSSProperties = {
  margin: 0,
  color: "#5f7188",
  lineHeight: 1.65,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  color: "#10233f",
};

const tableCellStyle: CSSProperties = {
  padding: "14px 0",
  borderBottom: "1px solid #e8eef4",
  textAlign: "left",
};

function maxValue(values: number[]) {
  return values.length ? Math.max(...values) : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function averageCloseTime(items: CloseTimeReportItem[]) {
  if (!items.length) return 0;
  return items.reduce((total, item) => total + item.average_hours_to_close, 0) / items.length;
}

function topPerformer<T>(items: T[], selector: (item: T) => number) {
  return items.reduce<T | null>((winner, item) => {
    if (!winner) return item;
    return selector(item) > selector(winner) ? item : winner;
  }, null);
}

function scoreTone(value: number, high: number, medium: number): "cold" | "warning" | "hot" {
  if (value >= high) return "cold";
  if (value >= medium) return "warning";
  return "hot";
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint: string; tone?: "cold" | "warning" | "hot" }) {
  return (
    <section style={cardStyle}>
      <div className="topbar-row">
        <p style={labelStyle}>{label}</p>
        {tone ? <Badge tone={tone}>{tone === "cold" ? "Healthy" : tone === "warning" ? "Watch" : "Risk"}</Badge> : null}
      </div>
      <p style={valueStyle}>{value}</p>
      <p style={copyStyle}>{hint}</p>
    </section>
  );
}

function MeterList<T>({
  items,
  max,
  renderLabel,
  renderValue,
  renderHint,
  accent,
}: {
  items: { key: string; value: number; meta: T }[];
  max: number;
  renderLabel: (item: { key: string; value: number; meta: T }) => ReactNode;
  renderValue: (item: { key: string; value: number; meta: T }) => ReactNode;
  renderHint?: (item: { key: string; value: number; meta: T }) => ReactNode;
  accent: string;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "grid", gap: 10 }}>
          <div className="topbar-row">
            <strong style={{ color: "#10233f" }}>{renderLabel(item)}</strong>
            <span style={{ color: "#5f7188" }}>{renderValue(item)}</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              overflow: "hidden",
              background: "#e8eef5",
            }}
          >
            <div
              style={{
                width: `${max ? (item.value / max) * 100 : 0}%`,
                height: "100%",
                borderRadius: 999,
                background: accent,
              }}
            />
          </div>
          {renderHint ? <div style={{ color: "#5f7188" }}>{renderHint(item)}</div> : null}
        </div>
      ))}
    </div>
  );
}

function NarrativeTable({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <div className="list-stack" style={{ gap: 6 }}>
        <p style={labelStyle}>{title}</p>
        <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.04em", color: "#10233f" }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const { api } = useAuth();
  const summary = useAsyncResource(() => api.getReportSummary(), []);

  if (summary.isLoading) {
    return <LoadingState title="Loading reports" copy="Collecting funnel, advisor, close-time, and channel performance." />;
  }

  if (summary.error) {
    return <ErrorState title="Reports failed to load" copy={summary.error} action={{ label: "Retry", onClick: summary.reload }} />;
  }

  const data = summary.data;
  if (!data) {
    return <EmptyState title="No report payload" copy="The reports endpoint returned no aggregate data for this workspace." />;
  }

  const totalWon = data.sales_by_advisor.reduce((total, item) => total + item.won_leads, 0);
  const totalEntered = data.conversion_by_stage.reduce((total, item) => total + item.entered_leads, 0);
  const avgClose = averageCloseTime(data.average_close_time);
  const overallProgressed = data.conversion_by_stage.reduce((total, item) => total + item.progressed_leads, 0);
  const conversionCoverage = totalEntered ? (overallProgressed / totalEntered) * 100 : 0;

  const topAdvisor = topPerformer(data.sales_by_advisor, (item) => item.won_leads);
  const strongestStage = topPerformer(data.conversion_by_stage, (item) => item.conversion_rate);
  const mainChannel = topPerformer(data.leads_by_channel, (item) => item.leads);
  const mainLoss = topPerformer(data.loss_reasons, (item) => item.leads);

  const maxAdvisorWins = maxValue(data.sales_by_advisor.map((item) => item.won_leads));
  const maxStageEntries = maxValue(data.conversion_by_stage.map((item) => item.entered_leads));
  const maxChannelLeads = maxValue(data.leads_by_channel.map((item) => item.leads));

  const advisorItems = data.sales_by_advisor.map((item) => ({
    key: `${item.advisor_user_id || "unassigned"}-${item.advisor_name}`,
    value: item.won_leads,
    meta: item,
  }));
  const stageItems = data.conversion_by_stage.map((item) => ({
    key: item.stage_id,
    value: item.entered_leads,
    meta: item,
  }));
  const channelItems = data.leads_by_channel.map((item) => ({
    key: item.source_channel,
    value: item.leads,
    meta: item,
  }));

  return (
    <div className="page-stack" style={pageTheme}>
      <div style={shellStyle}>
        <PageHeader
          eyebrow="Performance Reporting"
          title="Reports"
          description="Executive-friendly funnel reporting for advisor output, stage progression, close velocity, acquisition mix, and loss patterns."
          meta={<Badge tone={conversionCoverage >= 60 ? "cold" : conversionCoverage >= 40 ? "warning" : "hot"}>{formatPercent(conversionCoverage)} progressed</Badge>}
        />

        <div style={summaryGridStyle}>
          <SummaryCard
            label="Won leads"
            value={formatNumber(totalWon)}
            hint={topAdvisor ? `${topAdvisor.advisor_name} leads the board with ${topAdvisor.won_leads} closed-won deals.` : "Closed-won activity will appear here once advisors start converting opportunities."}
            tone={scoreTone(totalWon, 20, 8)}
          />
          <SummaryCard
            label="Funnel coverage"
            value={formatPercent(conversionCoverage)}
            hint={strongestStage ? `${strongestStage.stage_name} is the strongest stage at ${formatPercent(strongestStage.conversion_rate)} conversion.` : "Stage conversion will become available after leads start moving through the pipeline."}
            tone={scoreTone(conversionCoverage, 60, 40)}
          />
          <SummaryCard
            label="Average close time"
            value={formatHours(avgClose)}
            hint={avgClose ? "Measured across won and lost outcomes to show total time spent before closure." : "Close-time reporting starts once leads begin reaching final stages."}
            tone={scoreTone(avgClose === 0 ? 0 : 100 - avgClose, 70, 45)}
          />
          <SummaryCard
            label="Primary acquisition channel"
            value={mainChannel ? mainChannel.source_channel : "No source data"}
            hint={mainChannel ? `${formatNumber(mainChannel.leads)} leads originated from the leading channel.` : "Source mix will populate as new leads enter with channel attribution."}
          />
        </div>

        <div style={splitGridStyle}>
          <NarrativeTable title="Advisor performance" subtitle="Closed-won output by advisor">
            {advisorItems.length ? (
              <MeterList
                items={advisorItems}
                max={maxAdvisorWins}
                accent="linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)"
                renderLabel={(item) => (item.meta as AdvisorSalesReportItem).advisor_name}
                renderValue={(item) => `${formatNumber(item.value)} won`}
                renderHint={(item) => {
                  const advisor = item.meta as AdvisorSalesReportItem;
                  const share = totalWon ? (advisor.won_leads / totalWon) * 100 : 0;
                  return `${formatPercent(share)} of all won leads`;
                }}
              />
            ) : (
              <EmptyState title="No advisor sales yet" copy="Closed-won data will populate this view once leads start closing successfully." />
            )}
          </NarrativeTable>

          <NarrativeTable title="Close velocity" subtitle="Average hours to resolution">
            {data.average_close_time.length ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...tableCellStyle, color: "#71839a", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Outcome</th>
                    <th style={{ ...tableCellStyle, color: "#71839a", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Leads</th>
                    <th style={{ ...tableCellStyle, color: "#71839a", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {data.average_close_time.map((item) => (
                    <tr key={item.closed_stage_type}>
                      <td style={tableCellStyle}>{item.closed_stage_type}</td>
                      <td style={tableCellStyle}>{formatNumber(item.closed_leads)}</td>
                      <td style={tableCellStyle}>{formatHours(item.average_hours_to_close)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No close-time data yet" copy="Close velocity becomes available after leads start landing in won or lost stages." />
            )}
          </NarrativeTable>
        </div>

        <div style={splitGridStyle}>
          <NarrativeTable title="Stage conversion" subtitle="Where funnel progression is strongest">
            {stageItems.length ? (
              <MeterList
                items={stageItems}
                max={maxStageEntries}
                accent="linear-gradient(90deg, #0f766e 0%, #2dd4bf 100%)"
                renderLabel={(item) => (item.meta as StageConversionReportItem).stage_name}
                renderValue={(item) => `${formatNumber(item.value)} entered`}
                renderHint={(item) => {
                  const stage = item.meta as StageConversionReportItem;
                  return `${formatNumber(stage.progressed_leads)} progressed • ${formatPercent(stage.conversion_rate)} conversion`;
                }}
              />
            ) : (
              <EmptyState title="No stage history yet" copy="Stage conversion appears after leads start moving through the pipeline." />
            )}
          </NarrativeTable>

          <NarrativeTable title="Acquisition mix" subtitle="Lead creation by source channel">
            {channelItems.length ? (
              <MeterList
                items={channelItems}
                max={maxChannelLeads}
                accent="linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)"
                renderLabel={(item) => (item.meta as LeadsByChannelItem).source_channel}
                renderValue={(item) => `${formatNumber(item.value)} leads`}
                renderHint={(item) => {
                  const channel = item.meta as LeadsByChannelItem;
                  const share = maxChannelLeads ? (channel.leads / data.leads_by_channel.reduce((total, current) => total + current.leads, 0)) * 100 : 0;
                  return `${formatPercent(share)} of all attributed leads`;
                }}
              />
            ) : (
              <EmptyState title="No acquisition channel data" copy="Channel reporting fills as new leads are created with source attribution." />
            )}
          </NarrativeTable>
        </div>

        <div style={splitGridStyle}>
          <NarrativeTable title="Loss reasons" subtitle="Patterns behind lost opportunities">
            {data.loss_reasons.length ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...tableCellStyle, color: "#71839a", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Reason</th>
                    <th style={{ ...tableCellStyle, color: "#71839a", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Lost leads</th>
                    <th style={{ ...tableCellStyle, color: "#71839a", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.loss_reasons.map((item) => {
                    const totalLosses = data.loss_reasons.reduce((total, current) => total + current.leads, 0);
                    const share = totalLosses ? (item.leads / totalLosses) * 100 : 0;
                    return (
                      <tr key={item.reason}>
                        <td style={tableCellStyle}>{item.reason}</td>
                        <td style={tableCellStyle}>{formatNumber(item.leads)}</td>
                        <td style={tableCellStyle}>{formatPercent(share)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No loss reasons registered" copy="Loss reasons will appear once leads reach lost stages with a recorded reason." />
            )}
          </NarrativeTable>

          <section style={{ ...cardStyle, alignContent: "start" }}>
            <div className="list-stack" style={{ gap: 8 }}>
              <p style={labelStyle}>Management notes</p>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.04em", color: "#10233f" }}>
                Current takeaways
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gap: 14,
                padding: 18,
                borderRadius: 18,
                background: "#f7f9fc",
                border: "1px solid #e6ecf2",
              }}
            >
              <div>
                <p style={labelStyle}>Top advisor</p>
                <p style={copyStyle}>{topAdvisor ? `${topAdvisor.advisor_name} is carrying ${formatNumber(topAdvisor.won_leads)} won leads.` : "No advisor winner yet."}</p>
              </div>
              <div>
                <p style={labelStyle}>Strongest stage</p>
                <p style={copyStyle}>
                  {strongestStage
                    ? `${strongestStage.stage_name} converts at ${formatPercent(strongestStage.conversion_rate)} with ${formatNumber(strongestStage.progressed_leads)} leads advancing.`
                    : "No stage trend is available yet."}
                </p>
              </div>
              <div>
                <p style={labelStyle}>Main loss driver</p>
                <p style={copyStyle}>
                  {mainLoss
                    ? `${mainLoss.reason} is the top recorded reason, affecting ${formatNumber(mainLoss.leads)} lost opportunities.`
                    : "No loss reason trend is available yet."}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
