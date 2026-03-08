"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

function maxValue(values: number[]) {
  return values.length ? Math.max(...values) : 0;
}

export default function ReportsPage() {
  const { api } = useAuth();
  const summary = useAsyncResource(() => api.getReportSummary(), []);

  if (summary.isLoading) {
    return <LoadingState title="Loading reports" copy="Collecting aggregated sales, funnel and closure metrics." />;
  }

  if (summary.error) {
    return <ErrorState title="Reports failed to load" copy={summary.error} action={{ label: "Retry", onClick: summary.reload }} />;
  }

  const data = summary.data;
  if (!data) {
    return <EmptyState title="No report payload" copy="The reports endpoint returned no aggregate data for this tenant." />;
  }

  const totalWon = data.sales_by_advisor.reduce((total, item) => total + item.won_leads, 0);
  const totalEntered = data.conversion_by_stage.reduce((total, item) => total + item.entered_leads, 0);
  const avgClose = data.average_close_time.reduce((total, item) => total + item.average_hours_to_close, 0);
  const maxAdvisorWins = maxValue(data.sales_by_advisor.map((item) => item.won_leads));
  const maxStageEntries = maxValue(data.conversion_by_stage.map((item) => item.entered_leads));
  const maxChannelLeads = maxValue(data.leads_by_channel.map((item) => item.leads));
  const maxLosses = maxValue(data.loss_reasons.map((item) => item.leads));

  return (
    <div className="page-stack">
      <PageHeader
        title="Reports"
        description="Operational reporting wired to the aggregated backend surface for advisor sales, stage conversion, close time, channels and loss reasons."
      />

      <div className="stats-grid">
        <StatCard label="Won leads" value={totalWon} hint="Total closed-won leads attributed in advisor sales report." />
        <StatCard label="Funnel entries" value={totalEntered} hint="Total stage entries captured in stage movement history." />
        <StatCard
          label="Avg. close hours"
          value={data.average_close_time.length ? (avgClose / data.average_close_time.length).toFixed(1) : "0.0"}
          hint="Average across won and lost close-time buckets."
        />
      </div>

      <div className="two-column-grid">
        <Card title="Sales by advisor" subtitle="Backed by GET /reports/sales-by-advisor via /reports/summary.">
          {data.sales_by_advisor.length ? (
            <div className="report-stack">
              {data.sales_by_advisor.map((item) => (
                <div className="report-row" key={`${item.advisor_user_id || "unassigned"}-${item.advisor_name}`}>
                  <div className="topbar-row">
                    <strong>{item.advisor_name}</strong>
                    <span className="muted-text">{item.won_leads} won</span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${maxAdvisorWins ? (item.won_leads / maxAdvisorWins) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No advisor sales yet" copy="Closed-won data will populate this report when leads reach a won stage." />
          )}
        </Card>

        <Card title="Average close time" subtitle="Backed by GET /reports/average-close-time.">
          {data.average_close_time.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Closed state</th>
                    <th>Leads</th>
                    <th>Avg hours</th>
                  </tr>
                </thead>
                <tbody>
                  {data.average_close_time.map((item) => (
                    <tr key={item.closed_stage_type}>
                      <td>{item.closed_stage_type}</td>
                      <td>{item.closed_leads}</td>
                      <td>{item.average_hours_to_close.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No close-time data yet" copy="Close-time reporting starts once leads are moved into won or lost stages." />
          )}
        </Card>
      </div>

      <div className="two-column-grid">
        <Card title="Conversion by stage" subtitle="Backed by GET /reports/conversion-by-stage.">
          {data.conversion_by_stage.length ? (
            <div className="report-stack">
              {data.conversion_by_stage.map((item) => (
                <div className="report-row" key={item.stage_id}>
                  <div className="topbar-row">
                    <strong>{item.stage_name}</strong>
                    <span className="muted-text">
                      {item.progressed_leads}/{item.entered_leads} progressed
                    </span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${maxStageEntries ? (item.entered_leads / maxStageEntries) * 100 : 0}%` }} />
                  </div>
                  <div className="topbar-row">
                    <span className="muted-text">Conversion rate</span>
                    <strong>{item.conversion_rate.toFixed(2)}%</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No stage history yet" copy="Stage conversion appears after leads move through the pipeline." />
          )}
        </Card>

        <Card title="Leads by channel" subtitle="Backed by GET /reports/lead-sources.">
          {data.leads_by_channel.length ? (
            <div className="report-stack">
              {data.leads_by_channel.map((item) => (
                <div className="report-row" key={item.source_channel}>
                  <div className="topbar-row">
                    <strong>{item.source_channel}</strong>
                    <span className="muted-text">{item.leads} leads</span>
                  </div>
                  <div className="meter meter--accent">
                    <span style={{ width: `${maxChannelLeads ? (item.leads / maxChannelLeads) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No acquisition channel data" copy="Lead source reporting fills as new leads are created with a source channel." />
          )}
        </Card>
      </div>

      <Card title="Loss reasons" subtitle="Backed by GET /reports/loss-reasons.">
        {data.loss_reasons.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Leads</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {data.loss_reasons.map((item) => (
                  <tr key={item.reason}>
                    <td>{item.reason}</td>
                    <td>{item.leads}</td>
                    <td>
                      <div className="meter meter--warning">
                        <span style={{ width: `${maxLosses ? (item.leads / maxLosses) * 100 : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No loss reasons registered" copy="Loss reasons will show once leads are moved into lost stages with a reason payload." />
        )}
      </Card>
    </div>
  );
}
