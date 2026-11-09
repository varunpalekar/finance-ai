export function parseEarnings(earningsRaw, analysisRaw, transcriptRaw, options = {}) {
  const ticker = options.ticker || '';
  const includeTranscript = options.includeTranscript ?? false;
  const chapterFilter = options.chapterFilter || 'prepared_remarks';
  const list = Array.isArray(earningsRaw) ? earningsRaw : [];

  if (list.length === 0) {
    return {
      ticker,
      active_event_id: null,
      fiscal_period: null,
      fiscal_year: null,
      consensus_comparison: null,
      historical_quarters: [],
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
      historical_quarters: [],
      ai_highlights: [],
      transcript: null
    };
  }

  const actualRev = typeof activeEvent.actualRevenue === 'number' ? activeEvent.actualRevenue : null;
  const estRev = typeof activeEvent.estimatedRevenue === 'number' ? activeEvent.estimatedRevenue : null;
  const actualRevCr = actualRev !== null ? Number((actualRev / 1e7).toFixed(2)) : null;
  const estRevCr = estRev !== null ? Number((estRev / 1e7).toFixed(2)) : null;
  const actualEps = typeof activeEvent.actualEps === 'number' ? activeEvent.actualEps : null;
  const estEps = typeof activeEvent.estimatedEps === 'number' ? activeEvent.estimatedEps : null;

  const revBeat = (actualRev !== null && estRev !== null && estRev !== 0)
    ? Number((((actualRev - estRev) / estRev) * 100).toFixed(2))
    : null;

  const epsBeat = (actualEps !== null && estEps !== null && estEps !== 0)
    ? Number((((actualEps - estEps) / Math.abs(estEps)) * 100).toFixed(2))
    : null;

  const historicalQuarters = list.map(q => {
    const qActualRev = typeof q?.actualRevenue === 'number' ? q.actualRevenue : null;
    const qEstRev = typeof q?.estimatedRevenue === 'number' ? q.estimatedRevenue : null;
    return {
      id: q?.id ?? null,
      fiscal_year: q?.fiscalYear ?? null,
      fiscal_period: q?.fiscalPeriod ?? null,
      date: q?.date ?? null,
      actual_revenue: qActualRev,
      actual_revenue_crores: qActualRev !== null ? Number((qActualRev / 1e7).toFixed(2)) : null,
      estimated_revenue: qEstRev,
      estimated_revenue_crores: qEstRev !== null ? Number((qEstRev / 1e7).toFixed(2)) : null,
      actual_eps: typeof q?.actualEps === 'number' ? q.actualEps : null,
      estimated_eps: typeof q?.estimatedEps === 'number' ? q.estimatedEps : null,
      currency: 'INR'
    };
  });

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
    const chapters = Array.isArray(transcriptRaw.chapters) ? transcriptRaw.chapters : [];

    let filtered = rawParagraphs;
    if (chapters.length > 0) {
      const prChapter = chapters.find(c => c.title?.toLowerCase().includes('prepared remarks'));
      const qaChapter = chapters.find(c => c.title?.toLowerCase().includes('q&a') || c.title?.toLowerCase().includes('question'));

      if (chapterFilter === 'qa' && qaChapter) {
        filtered = rawParagraphs.filter(p => typeof p.time === 'number' && p.time >= qaChapter.startTimestamp && (qaChapter.endTimestamp == null || p.time <= qaChapter.endTimestamp));
      } else if (chapterFilter === 'prepared_remarks' && prChapter) {
        filtered = rawParagraphs.filter(p => typeof p.time === 'number' && p.time >= (prChapter.startTimestamp || 0) && p.time <= prChapter.endTimestamp);
      }
    }

    transcript = {
      audio_url: transcriptRaw.audio || null,
      chapter_selected: chapterFilter,
      chapters,
      total_paragraphs: filtered.length,
      is_truncated: filtered.length > 50,
      paragraphs: filtered.slice(0, 50).map(p => ({
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
      actual_revenue_crores: actualRevCr,
      estimated_revenue: estRev,
      estimated_revenue_crores: estRevCr,
      revenue_beat_percent: revBeat,
      actual_eps: actualEps,
      estimated_eps: estEps,
      eps_beat_percent: epsBeat,
      currency: 'INR'
    },
    historical_quarters: historicalQuarters,
    ai_highlights: aiHighlights,
    transcript
  };
}
