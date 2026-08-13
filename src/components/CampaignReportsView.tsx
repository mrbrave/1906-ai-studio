import React, { useState } from 'react';
import { CampaignReport } from '../types/persona';
import { Layers, Calendar, Award, Download, FileText, ChevronRight } from 'lucide-react';

interface CampaignReportsViewProps {
  reports: CampaignReport[];
  onClearReports?: () => void;
}

export const CampaignReportsView: React.FC<CampaignReportsViewProps> = ({
  reports
}) => {
  const [selectedReport, setSelectedReport] = useState<CampaignReport | null>(
    reports.length > 0 ? reports[0] : null
  );

  const exportReportAsMarkdown = (report: CampaignReport) => {
    let md = `# 1906.ai Telemetry Validation Archive\n`;
    md += `**Date:** ${new Date(report.timestamp).toLocaleString()}\n`;
    md += `**Validated Narrative:** "${report.pitchHeadline}"\n`;
    md += `**Matrix Average Intent Score:** ${report.averageIntentScore}%\n\n`;
    md += `## Strategic Assessment\n${report.overallRecommendation}\n\n`;
    md += `## Cognitive Archetype Responses\n\n`;

    report.analyses.forEach((a, idx) => {
      md += `### ${idx + 1}. ${a.personaName} (${a.personaRole})\n`;
      md += `- **Conversion Intent:** ${a.intentScore}%\n`;
      md += `- **Reaction:** "${a.response}"\n`;
      md += `- **Friction / Objection:** ${a.topObjection}\n`;
      md += `- **Recommended Tweak:** ${a.suggestedTweak}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1906ai_telemetry_archive_${report.id}.md`;
    a.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-brand-bg-light marker-stroke agency-shadow card-irregular-1 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-headline font-bold text-brand-primary uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" /> Strategic Intelligence History
          </div>
          <h2 className="font-headline font-black text-xl text-brand-text">Telemetry Archives</h2>
          <p className="text-xs font-medium text-brand-text-light">
            Review past broadcast validation telemetry data, matrix intent averages, and exported strategic briefs.
          </p>
        </div>

        <span className="text-xs font-headline font-extrabold px-3 py-1.5 rounded-xl bg-brand-pale text-brand-dark border-2 border-brand-primary">
          {reports.length} Archived Telemetry Reports
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-20 bg-brand-bg-light rounded-3xl marker-stroke p-8 space-y-3">
          <FileText className="w-10 h-10 text-brand-primary mx-auto opacity-70" />
          <h3 className="font-headline font-black text-brand-text">No Telemetry Logs Archived</h3>
          <p className="text-xs font-medium text-brand-text-light max-w-sm mx-auto">
            Execute a Broadcast Validation test across your cognitive models to automatically generate strategic telemetry archives.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Reports List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            {reports.map((rep) => {
              const isSelected = selectedReport?.id === rep.id;
              return (
                <button
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all space-y-2 ${
                    isSelected
                      ? 'bg-brand-pale border-brand-primary agency-shadow-sm font-bold'
                      : 'bg-brand-bg-light border-brand-text/30 hover:border-brand-text'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-text-light flex items-center gap-1 font-mono font-semibold">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(rep.timestamp).toLocaleDateString()}
                    </span>
                    <span className="font-headline font-black text-brand-primary">
                      {rep.averageIntentScore}% Intent
                    </span>
                  </div>

                  <p className="font-headline font-black text-xs text-brand-text line-clamp-2">
                    "{rep.pitchHeadline}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-light pt-1">
                    <span>{rep.analyses.length} Cognitive Models</span>
                    <ChevronRight className="w-4 h-4 text-brand-text-light" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Selected Report Detail (8 cols) */}
          {selectedReport && (
            <div className="lg:col-span-8 bg-brand-bg-light marker-stroke agency-shadow card-irregular-2 p-6 space-y-6">
              
              {/* Report Header */}
              <div className="flex items-start justify-between border-b-2 border-brand-text/20 pb-4 gap-4">
                <div>
                  <span className="text-[10px] font-headline font-bold uppercase tracking-wider text-brand-text-light block mb-1">
                    Validated Narrative Copy:
                  </span>
                  <h3 className="font-headline font-black text-base text-brand-text">
                    "{selectedReport.pitchHeadline}"
                  </h3>
                  <p className="text-xs font-semibold text-brand-text-light mt-1">
                    Archive ID: {selectedReport.id} • {new Date(selectedReport.timestamp).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => exportReportAsMarkdown(selectedReport)}
                  className="px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary text-brand-bg font-headline font-black text-xs rounded-xl marker-stroke agency-shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export .MD Archive</span>
                </button>
              </div>

              {/* Recommendation */}
              <div className="bg-brand-pale border-2 border-brand-primary p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-headline font-black uppercase text-brand-dark flex items-center gap-1">
                  <Award className="w-4 h-4 text-brand-primary" /> Strategic Telemetry Assessment
                </span>
                <p className="text-xs font-medium text-brand-text leading-relaxed">
                  {selectedReport.overallRecommendation}
                </p>
              </div>

              {/* Segment Matrix */}
              <div className="space-y-3">
                <h4 className="font-headline font-black text-xs uppercase text-brand-text tracking-wider">
                  Cognitive Archetype Response Matrix
                </h4>

                <div className="space-y-3">
                  {selectedReport.analyses.map((item, idx) => (
                    <div
                      key={item.personaId}
                      className="bg-brand-bg p-4 rounded-2xl border-2 border-brand-text/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{item.personaAvatar}</span>
                          <div>
                            <span className="font-headline font-black text-xs text-brand-text">{item.personaName}</span>
                            <span className="text-[11px] font-semibold text-brand-text-light ml-2">({item.personaRole})</span>
                          </div>
                        </div>

                        <span className="text-sm font-headline font-black text-brand-primary">
                          {item.intentScore}% Intent
                        </span>
                      </div>

                      <p className="text-xs text-brand-text-light font-medium italic">
                        "{item.response}"
                      </p>

                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold pt-1">
                        <span className="bg-rose-100 text-rose-900 border border-rose-800 px-2 py-0.5 rounded-md">
                          Friction: {item.topObjection}
                        </span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-800 px-2 py-0.5 rounded-md">
                          Recommended Fix: {item.suggestedTweak}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
