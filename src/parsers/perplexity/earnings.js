export function parseEarnings(earningsRaw, analysisRaw, transcriptRaw, options = {}) {
  const ticker = options.ticker || '';
  const includeTranscript = options.includeTranscript ?? false;
  const list = Array.isArray(earningsRaw) ? earningsRaw : [];

  if (list.length === 0) {
    return {
      ticker,
      active_event_id: null,
      fiscal_period: null,
      fiscal_year: null,
      consensus_comparison: null,
      ai_highlights: [],
      transcript: null
    };
  }

  const activeEvent = options.eventId
    ? list.find(e => e && e.id === Number(options.eventId))
    : (list.find(e => e && e.actualRevenue != null) || list[0]);

  if (!activeEvent) {
    return {
      ticker,
      active_event_id: null,
      fiscal_period: null,
      fiscal_year: null,
      consensus_comparison: null,
      ai_highlights: [],
      transcript: null
    };
  }

  const actualRev = typeof activeEvent.actualRevenue === 'number' ? activeEvent.actualRevenue : null;
  const estRev = typeof activeEvent.estimatedRevenue === 'number' ? activeEvent.estimatedRevenue : null;
  const actualEps = typeof activeEvent.actualEps === 'number' ? activeEvent.actualEps : null;
  const estEps = typeof activeEvent.estimatedEps === 'number' ? activeEvent.estimatedEps : null;

  const revBeat = (actualRev !== null && estRev !== null && estRev !== 0)
    ? Number((((actualRev - estRev) / estRev) * 100).toFixed(2))
    : null;

  const epsBeat = (actualEps !== null && estEps !== null && estEps !== 0)
    ? Number((((actualEps - estEps) / Math.abs(estEps)) * 100).toFixed(2))
    : null;

  let aiHighlights = [];
  if (analysisRaw?.analysis && typeof analysisRaw.analysis === 'string') {
    aiHighlights = analysisRaw.analysis
      .split(/\n[-*]\s+/)
      .map(s => s.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
  }

  let transcript = null;
  if (includeTranscript && transcriptRaw?.paragraphs) {
    const rawParagraphs = Array.isArray(transcriptRaw.paragraphs) ? transcriptRaw.paragraphs : [];
    transcript = {
      paragraphs: rawParagraphs.slice(0, 50).map(p => ({
        speaker: p.speakers?.[0] || 'Unknown',
        text: p.text || '',
        time: p.time ?? null
      }))
    };
  }

  return {
    ticker,
    active_event_id: activeEvent.id ?? null,
    fiscal_period: activeEvent.fiscalPeriod ?? null,
    fiscal_year: activeEvent.fiscalYear ?? null,
    date: activeEvent.date ?? null,
    consensus_comparison: {
      actual_revenue: actualRev,
      estimated_revenue: estRev,
      revenue_beat_percent: revBeat,
      actual_eps: actualEps,
      estimated_eps: estEps,
      eps_beat_percent: epsBeat
    },
    ai_highlights: aiHighlights,
    transcript
  };
}
