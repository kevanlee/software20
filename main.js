(function () {
  const STORAGE_KEY = "signalstack_benchmark";

  const defaultState = {
    company: "Figma",
    url: "https://www.figma.com",
    category: "AI-inferred category pending",
    persona: "AI-assisted onboarding",
    notes: "SignalStack will infer category, positioning, and brand context from the confirmed brand and website in a future iteration.",
    competitors: ["Canva", "Adobe XD", "Sketch", "Framer"],
    authProvider: "Google",
    authEmail: "hello@figma.com",
  };

  const mockAccounts = {
    figma: {
      company: "Figma",
      url: "https://www.figma.com",
      authEmail: "hello@figma.com",
      competitors: ["Canva", "Adobe XD", "Sketch", "Framer"],
    },
    notion: {
      company: "Notion",
      url: "https://www.notion.so",
      authEmail: "team@notion.so",
      competitors: ["Airtable", "Asana", "Coda", "ClickUp"],
    },
    loom: {
      company: "Loom",
      url: "https://www.loom.com",
      authEmail: "growth@loom.com",
      competitors: ["Vidyard", "Synthesia", "Wistia", "Vimeo"],
    },
  };

  function loadState() {
    try {
      return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
    } catch {
      return { ...defaultState };
    }
  }

  function saveState(nextState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  function sanitizeCompetitors(inputs) {
    return inputs.map((value) => value.trim()).filter(Boolean);
  }

  function normalizeUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return defaultState.url;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function shortUrl(url) {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }

  function createSvgNode(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });
    return node;
  }

  const chartTheme = {
    axis: "rgba(20, 17, 15, 0.2)",
    grid: "rgba(20, 17, 15, 0.1)",
    label: "#6d6258",
    labelStrong: "#14110f",
    company: "#d95f39",
    companyAlt: "#a2372d",
    competitor: "rgba(86, 74, 66, 0.56)",
    competitorStrong: "#5d5047",
    accent: "#2f7854",
    warning: "#c39b2a",
    danger: "#b44b3e",
    track: "rgba(20, 17, 15, 0.08)",
  };

  function hash(value) {
    let total = 0;
    for (let i = 0; i < value.length; i += 1) {
      total = (total * 31 + value.charCodeAt(i)) % 1000003;
    }
    return total;
  }

  function valueFromName(name, min, max, salt) {
    const spread = max - min + 1;
    return min + (hash(`${salt}:${name}`) % spread);
  }

  function buildDataset(state) {
    const brands = [state.company, ...state.competitors].slice(0, 5);
    const dataset = brands.map((name, index) => {
      const unaided = valueFromName(name, 38, 74, "unaided");
      const aided = Math.max(unaided + valueFromName(name, 8, 20, "aided"), unaided + 6);
      const social = valueFromName(name, 12, 37, "social");
      const ads = valueFromName(name, 8, 31, "ads");
      const earned = valueFromName(name, 9, 33, "earned");
      const g2Score = valueFromName(name, 39, 49, "g2") / 10;
      const capterraScore = valueFromName(name, 38, 49, "capterra") / 10;
      const llmVisibility = valueFromName(name, 41, 82, "llm");
      const composite = Math.round((unaided + aided + social + ads + earned + llmVisibility) / 6);

      return {
        name,
        order: index,
        aided,
        unaided,
        social,
        ads,
        earned,
        g2Score: Number(g2Score.toFixed(1)),
        capterraScore: Number(capterraScore.toFixed(1)),
        llmVisibility,
        composite,
      };
    });

    const companyRow = dataset[0];
    if (companyRow.composite < 74) {
      companyRow.composite += 7;
      companyRow.unaided += 6;
      companyRow.aided += 5;
      companyRow.social += 4;
      companyRow.llmVisibility += 7;
    }

    return dataset
      .map((row) => ({
        ...row,
        aided: Math.min(row.aided, 92),
        unaided: Math.min(row.unaided, 88),
        social: Math.min(row.social, 44),
        ads: Math.min(row.ads, 37),
        earned: Math.min(row.earned, 39),
        llmVisibility: Math.min(row.llmVisibility, 90),
        composite: Math.min(row.composite, 92),
      }))
      .sort((a, b) => b.composite - a.composite);
  }

  function renderText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  }

  function setTextIfPresent(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatDelta(value, suffix = "%") {
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded}${suffix}`;
  }

  function formatMetricValue(value, unit) {
    if (unit === "%") return `${Math.round(value)}%`;
    if (unit === "score") return `${Math.round(value)}`;
    if (unit === "k") return `${(Math.round(value * 10) / 10).toFixed(1)}K`;
    return `${Math.round(value)}`;
  }

  function buildSeries(seed, length, start, step, min, max) {
    const values = [];
    let current = start;

    for (let index = 0; index < length; index += 1) {
      const drift = (hash(`${seed}:${index}`) % (step * 2 + 1)) - step;
      current = clamp(current + drift, min, max);
      values.push(current);
    }

    return values;
  }

  function renderSparkBarChart(svg, values) {
    if (!svg) return;
    svg.innerHTML = "";

    const width = 320;
    const height = 96;
    const padding = 6;
    const max = Math.max(...values, 1);
    const barWidth = (width - padding * 2) / values.length - 4;

    values.forEach((value, index) => {
      const x = padding + index * (barWidth + 4);
      const chartHeight = ((height - 22) * value) / max;
      const y = height - chartHeight - 10;
      const isRecent = index >= values.length - 6;

      svg.appendChild(createSvgNode("rect", {
        x,
        y,
        width: barWidth,
        height: chartHeight,
        rx: 4,
        fill: isRecent ? "rgba(17, 17, 17, 0.72)" : "rgba(17, 17, 17, 0.24)",
      }));
    });
  }

  function renderMiniBarChart(svg, values) {
    if (!svg) return;
    svg.innerHTML = "";

    const width = 360;
    const height = 160;
    const left = 8;
    const right = 352;
    const bottom = 130;
    const top = 18;
    const max = Math.max(...values, 1);
    const barWidth = 30;
    const gap = (right - left - barWidth * values.length) / Math.max(values.length - 1, 1);

    svg.appendChild(createSvgNode("line", {
      x1: left,
      y1: bottom,
      x2: right,
      y2: bottom,
      stroke: "rgba(17, 17, 17, 0.12)",
    }));

    values.forEach((value, index) => {
      const x = left + index * (barWidth + gap);
      const chartHeight = ((bottom - top) * value) / max;
      const y = bottom - chartHeight;
      const isRecent = index >= values.length - 2;

      svg.appendChild(createSvgNode("rect", {
        x,
        y,
        width: barWidth,
        height: chartHeight,
        rx: 7,
        fill: isRecent ? "rgba(17, 17, 17, 0.82)" : "rgba(17, 17, 17, 0.24)",
      }));
    });
  }

  function renderDonutChart(svg, value) {
    if (!svg) return;
    svg.innerHTML = "";

    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    const normalized = clamp(value, 0, 100);
    const dash = (circumference * normalized) / 100;

    svg.appendChild(createSvgNode("circle", {
      cx: 90,
      cy: 90,
      r: radius,
      fill: "none",
      stroke: "rgba(17, 17, 17, 0.08)",
      "stroke-width": 18,
    }));

    svg.appendChild(createSvgNode("circle", {
      cx: 90,
      cy: 90,
      r: radius,
      fill: "none",
      stroke: "rgba(17, 17, 17, 0.82)",
      "stroke-width": 18,
      "stroke-linecap": "round",
      transform: "rotate(-90 90 90)",
      "stroke-dasharray": `${dash} ${circumference - dash}`,
    }));
  }

  function buildAwarenessDashboard(state, companyRow, companyRank) {
    const brandedSearchSeries = buildSeries(`${state.company}:branded-search`, 8, clamp(companyRow.unaided + 8, 36, 88), 5, 28, 96);
    const directTrafficSeries = buildSeries(`${state.company}:direct-traffic`, 8, clamp(companyRow.composite + 2, 40, 90), 4, 30, 94);
    const returningVisitorsSeries = buildSeries(`${state.company}:returning-visitors`, 8, clamp(companyRow.aided - 8, 35, 92), 4, 24, 90);
    const organicSignupsSeries = buildSeries(`${state.company}:organic-signups`, 8, clamp(companyRow.llmVisibility - 12, 30, 86), 5, 20, 92);
    const socialScoreSeries = buildSeries(`${state.company}:social-score`, 8, clamp(companyRow.social + 24, 28, 82), 5, 18, 88);
    const pulseSeries = buildSeries(`${state.company}:brand-pulse`, 20, clamp(companyRow.composite - 12, 24, 82), 4, 18, 92);

    const score = Math.round((companyRow.unaided * 0.28) + (companyRow.aided * 0.22) + (companyRow.social * 0.14) + (companyRow.llmVisibility * 0.18) + ((100 - companyRank * 6) * 0.18));
    const scoreDelta = ((hash(`${state.company}:score-delta`) % 61) - 15) / 10;

    const labels = [
      { min: 78, label: "Crushing it" },
      { min: 70, label: "Building momentum" },
      { min: 62, label: "Holding steady" },
      { min: 0, label: "Needs attention" },
    ];
    const scoreLabel = labels.find((entry) => score >= entry.min)?.label || "Holding steady";

    const metrics = [
      {
        label: "Branded search",
        value: brandedSearchSeries[7] * 0.16,
        previous: brandedSearchSeries[6] * 0.16,
        unit: "k",
      },
      {
        label: "Direct traffic",
        value: directTrafficSeries[7] * 210,
        previous: directTrafficSeries[6] * 210,
        unit: "",
      },
      {
        label: "Returning visitors",
        value: returningVisitorsSeries[7] * 145,
        previous: returningVisitorsSeries[6] * 145,
        unit: "",
      },
      {
        label: "Organic signups",
        value: organicSignupsSeries[7] * 4.1,
        previous: organicSignupsSeries[6] * 4.1,
        unit: "",
      },
      {
        label: "Social media score",
        value: socialScoreSeries[7],
        previous: socialScoreSeries[6],
        unit: "score",
      },
    ];

    const trendCards = [
      {
        title: "Branded search",
        series: brandedSearchSeries,
        value: formatMetricValue(brandedSearchSeries[7] * 0.16, "k"),
        delta: formatDelta(((brandedSearchSeries[7] - brandedSearchSeries[6]) / Math.max(brandedSearchSeries[6], 1)) * 100),
        caption: "Search demand index over the last eight weeks",
      },
      {
        title: "Direct traffic",
        series: directTrafficSeries,
        value: formatMetricValue(directTrafficSeries[7] * 210, ""),
        delta: formatDelta(((directTrafficSeries[7] - directTrafficSeries[6]) / Math.max(directTrafficSeries[6], 1)) * 100),
        caption: "Sessions landing directly on your site",
      },
      {
        title: "Returning visitors",
        series: returningVisitorsSeries,
        value: formatMetricValue(returningVisitorsSeries[7] * 145, ""),
        delta: formatDelta(((returningVisitorsSeries[7] - returningVisitorsSeries[6]) / Math.max(returningVisitorsSeries[6], 1)) * 100),
        caption: "Repeat audience behavior and revisit rate",
      },
      {
        title: "Organic signups",
        series: organicSignupsSeries,
        value: formatMetricValue(organicSignupsSeries[7] * 4.1, ""),
        delta: formatDelta(((organicSignupsSeries[7] - organicSignupsSeries[6]) / Math.max(organicSignupsSeries[6], 1)) * 100),
        caption: "Signups attributed to non-paid acquisition",
      },
    ];

    const pulseDelta = ((pulseSeries[pulseSeries.length - 1] - pulseSeries[pulseSeries.length - 8]) / Math.max(pulseSeries[pulseSeries.length - 8], 1)) * 100;

    return {
      score,
      scoreLabel,
      scoreDelta,
      pulseValue: pulseSeries[pulseSeries.length - 1],
      pulseDelta,
      pulseSeries,
      metrics,
      trendCards,
    };
  }

  function buildSovDashboard(state, dataset, companyRow, companyRank) {
    const companyVoice = clamp(companyRow.social + companyRow.ads + companyRow.earned, 0, 100);
    const marketVoice = dataset.reduce((sum, entry) => sum + clamp(entry.social + entry.ads + entry.earned, 0, 100), 0);
    const sharePercent = Math.round((companyVoice / Math.max(marketVoice, 1)) * 100);
    const score = clamp(Math.round((sharePercent * 1.2) + (companyRow.social * 0.55) + ((6 - companyRank) * 5)), 38, 92);
    const scoreDelta = ((hash(`${state.company}:sov-score-delta`) % 71) - 18) / 10;
    const shareDelta = ((hash(`${state.company}:share-delta`) % 61) - 14) / 10;
    const yourMentions = Math.round(companyVoice * 7.6);
    const yourMentionsDelta = ((hash(`${state.company}:mentions-delta`) % 81) - 18) / 10;
    const categoryMentions = Math.round(marketVoice * 8.9);
    const categoryMentionsDelta = ((hash(`${state.company}:category-delta`) % 71) - 14) / 10;
    const competitorVoice = Math.max(marketVoice - companyVoice, 0);
    const competitorMentions = Math.round(competitorVoice * 7.4);
    const competitorMentionsDelta = ((hash(`${state.company}:competitor-delta`) % 71) - 16) / 10;

    const scoreLabel = score >= 82
      ? "Ah-maz-ing"
      : score >= 72
        ? "Strong signal"
        : score >= 62
          ? "Building share"
          : "Needs attention";

    const associations = [
      "Affordable",
      "Cool",
      "Relatable",
      "Effective",
      "Trusted",
      "Modern",
    ];

    const mentionSets = {
      you: [
        {
          handle: "@growthbrief",
          date: "Mar 24",
          body: `${state.company} keeps coming up as the brand with the clearest point of view in this category. Their recent launch messaging was everywhere this week.`,
          source: "X / Social",
        },
        {
          handle: "@productloops",
          date: "Mar 23",
          body: `Seeing more teams reference ${state.company} unprompted in operator threads. That usually means the brand is earning conversational gravity, not just paid reach.`,
          source: "LinkedIn",
        },
        {
          handle: "@operatornotes",
          date: "Mar 22",
          body: `${state.company} has a noticeably stronger owned-to-earned handoff right now. The campaign sparked discussion instead of disappearing after launch day.`,
          source: "Newsletter",
        },
        {
          handle: "@benchwatch",
          date: "Mar 21",
          body: `The interesting part is how often ${state.company} is mentioned alongside category leaders now. That’s usually a sign of real share gains.`,
          source: "Industry blog",
        },
      ],
      competitors: dataset.slice(1, 5).map((entry, index) => ({
        handle: `@${entry.name.toLowerCase().replace(/\s+/g, "")}watch`,
        date: `Mar ${24 - index}`,
        body: `${entry.name} still owns part of the discussion, but the tone is less decisive this week. Mentions are showing up more in comparison threads than in standalone praise.`,
        source: index % 2 === 0 ? "Press" : "Community forum",
      })),
      category: [
        {
          handle: "@marketmap",
          date: "Mar 24",
          body: `Category conversation is tilting toward practical outcomes, clear positioning, and brands that feel easier to explain internally. Simpler narratives are winning.`,
          source: "Analyst note",
        },
        {
          handle: "@revopsroundup",
          date: "Mar 23",
          body: `There’s more chatter around who actually leads this category versus who simply spends the most. Buyers are rewarding brands with a crisp story.`,
          source: "Roundup",
        },
        {
          handle: "@fieldintel",
          date: "Mar 22",
          body: `Competitive mentions are still dense, but the category is consolidating around a smaller set of names that keep surfacing across channels.`,
          source: "Market forum",
        },
      ],
    };

    return {
      score,
      scoreLabel,
      scoreDelta,
      sharePercent,
      shareDelta,
      yourMentions,
      yourMentionsDelta,
      categoryMentions,
      categoryMentionsDelta,
      competitorMentions,
      competitorMentionsDelta,
      associations,
      mentionSets,
    };
  }

  function renderAwarenessDashboard(state, companyRow, companyRank) {
    const awarenessData = buildAwarenessDashboard(state, companyRow, companyRank);
    const metricGrid = document.getElementById("awareness-metric-grid");
    const trendGrid = document.getElementById("awareness-trend-grid");
    const pulseChart = document.getElementById("awareness-pulse-chart");
    const exportButton = document.getElementById("awareness-export-button");

    setTextIfPresent("awareness-intro-copy", `${state.company} is showing steady brand momentum across direct traffic, search demand, and repeat audience behavior this week.`);
    setTextIfPresent("awareness-score", `${awarenessData.score}`);
    setTextIfPresent("awareness-score-label", awarenessData.scoreLabel);
    setTextIfPresent("awareness-score-delta", `${formatDelta(awarenessData.scoreDelta, " pts")} vs last week`);
    setTextIfPresent("awareness-score-note", `${state.company} ranks #${companyRank} in the current peer set and is staying visible across both recall and discovery channels.`);
    setTextIfPresent("awareness-pulse-title", "Brand Pulse");
    setTextIfPresent("awareness-pulse-delta", `${formatDelta(awarenessData.pulseDelta)} WoW`);
    setTextIfPresent("awareness-pulse-copy", `Brand demand is ${awarenessData.pulseDelta >= 0 ? "compounding" : "softening"} across your awareness mix, led by ${awarenessData.metrics[0].label.toLowerCase()} and ${awarenessData.metrics[2].label.toLowerCase()}.`);
    setTextIfPresent("awareness-pulse-value", `${Math.round(awarenessData.pulseValue)}`);
    setTextIfPresent("notes-copy", state.notes || defaultState.notes);

    renderSparkBarChart(pulseChart, awarenessData.pulseSeries);

    if (metricGrid) {
      metricGrid.innerHTML = "";
      awarenessData.metrics.forEach((metric) => {
        const delta = ((metric.value - metric.previous) / Math.max(metric.previous, 1)) * 100;
        const card = document.createElement("article");
        card.className = "awareness-metric-card";
        card.innerHTML = `
          <div class="awareness-metric-top">
            <p class="box-label">${metric.label}</p>
            <span class="awareness-metric-change">${formatDelta(delta)}</span>
          </div>
          <div class="awareness-metric-card-copy">
            <strong>${formatMetricValue(metric.value, metric.unit)}</strong>
            <p>Current period performance vs last week</p>
          </div>
        `;
        metricGrid.appendChild(card);
      });

      const ctaCard = document.createElement("article");
      ctaCard.className = "awareness-cta-card";
      ctaCard.innerHTML = `
        <div>
          <p class="box-label">Conversation scan</p>
          <h3>See what people are saying</h3>
          <p>Open the qualitative conversation view to pair momentum with the stories behind it.</p>
        </div>
        <button class="button" type="button">Convos →</button>
      `;
      metricGrid.appendChild(ctaCard);
    }

    if (trendGrid) {
      trendGrid.innerHTML = "";
      awarenessData.trendCards.forEach((trend) => {
        const card = document.createElement("article");
        card.className = "awareness-trend-card";
        card.innerHTML = `
          <div class="awareness-trend-top">
            <div class="awareness-trend-card-copy">
              <p class="box-label">${trend.title}</p>
              <strong class="awareness-trend-value">${trend.value}</strong>
            </div>
            <span class="awareness-trend-change">${trend.delta} WoW</span>
          </div>
          <svg class="awareness-bar-chart" viewBox="0 0 360 160" role="img" aria-label="${trend.title} over 8 weeks"></svg>
          <p class="awareness-chart-caption">${trend.caption}</p>
        `;
        trendGrid.appendChild(card);
        renderMiniBarChart(card.querySelector("svg"), trend.series);
      });
    }

    if (exportButton && !exportButton.dataset.bound) {
      exportButton.dataset.bound = "true";
      exportButton.addEventListener("click", async () => {
        const shareText = `${state.company} awareness snapshot: score ${awarenessData.score}, ${awarenessData.metrics[0].label.toLowerCase()} at ${formatMetricValue(awarenessData.metrics[0].value, awarenessData.metrics[0].unit)}, and ${awarenessData.metrics[2].label.toLowerCase()} trending ${awarenessData.trendCards[2].delta} week over week.`;
        try {
          if (navigator.share) {
            await navigator.share({
              title: `${state.company} Awareness`,
              text: shareText,
            });
            return;
          }
        } catch {
          // Fall through to alert if share is unavailable or dismissed.
        }
        window.alert(shareText);
      });
    }
  }

  function renderSovDashboard(state, dataset, companyRow, companyRank) {
    const sovData = buildSovDashboard(state, dataset, companyRow, companyRank);
    const associationTags = document.getElementById("sov-association-tags");
    const mentionList = document.getElementById("sov-mention-list");
    const exportButton = document.getElementById("sov-export-button");
    const shareChart = document.getElementById("sov-share-chart");
    const filterButtons = Array.from(document.querySelectorAll("[data-sov-filter]"));
    const bottomMetrics = document.getElementById("sov-bottom-metrics");

    setTextIfPresent("sov-intro-copy", `${state.company} is holding visible share across editorial, community, and social discussion, with the strongest pickup coming from earned and organic conversation.`);
    setTextIfPresent("sov-score", `${sovData.score}`);
    setTextIfPresent("sov-score-label", sovData.scoreLabel);
    setTextIfPresent("sov-score-delta", `${formatDelta(sovData.scoreDelta, " pts")} vs last week`);
    setTextIfPresent("sov-score-note", `${state.company} ranks #${companyRank} in the current benchmark and is staying active across the channel mix that shapes category visibility.`);
    setTextIfPresent("sov-summary-title", "Convo Score");
    setTextIfPresent("sov-summary-delta", `${formatDelta(sovData.shareDelta)} WoW`);
    setTextIfPresent("sov-summary-copy", `${state.company} is winning a larger slice of conversation this week, driven by stronger organic mentions and steadier channel presence.`);
    setTextIfPresent("sov-share-value", `${sovData.sharePercent}%`);
    setTextIfPresent("sov-share-change", `${formatDelta(sovData.shareDelta)} WoW`);
    setTextIfPresent("sov-your-mentions-value", `${sovData.yourMentions}`);
    setTextIfPresent("sov-your-mentions-change", `${formatDelta(sovData.yourMentionsDelta)} WoW`);

    if (associationTags) {
      associationTags.innerHTML = "";
      sovData.associations.forEach((label) => {
        const tag = document.createElement("span");
        tag.className = "sov-association-tag";
        tag.textContent = label;
        associationTags.appendChild(tag);
      });
    }

    function renderMentionItems(filter) {
      if (!mentionList) return;
      mentionList.innerHTML = "";
      (sovData.mentionSets[filter] || sovData.mentionSets.you).forEach((item) => {
        const article = document.createElement("article");
        article.className = "sov-mention-item";
        article.innerHTML = `
          <div class="sov-mention-meta">
            <div class="sov-mention-header">
              <span class="sov-mention-handle">${item.handle}</span>
              <span class="sov-mention-date">${item.date}</span>
            </div>
            <span class="sov-mention-source">${item.source}</span>
          </div>
          <p class="sov-mention-body">${item.body}</p>
        `;
        mentionList.appendChild(article);
      });
    }

    if (filterButtons.length) {
      filterButtons.forEach((button) => {
        button.onclick = () => {
          const filter = button.getAttribute("data-sov-filter") || "you";
          filterButtons.forEach((candidate) => {
            const active = candidate === button;
            candidate.classList.toggle("is-active", active);
            candidate.setAttribute("aria-pressed", active ? "true" : "false");
          });
          renderMentionItems(filter);
        };
      });
    }

    renderMentionItems("you");
    renderDonutChart(shareChart, sovData.sharePercent);

    if (bottomMetrics) {
      bottomMetrics.innerHTML = "";
      [
        {
          title: "Category mentions",
          value: sovData.categoryMentions,
          delta: sovData.categoryMentionsDelta,
          copy: "Tracked references across the wider category conversation this week.",
        },
        {
          title: "Competitor mentions",
          value: sovData.competitorMentions,
          delta: sovData.competitorMentionsDelta,
          copy: "Combined competitor references captured across the same source mix.",
        },
      ].forEach((metric) => {
        const card = document.createElement("article");
        card.className = "sov-bottom-metric-card";
        card.innerHTML = `
          <div class="sov-bottom-metric-top">
            <div>
              <p class="box-label">${metric.title}</p>
              <strong class="sov-bottom-metric-value">${metric.value}</strong>
            </div>
            <span class="sov-bottom-metric-change">${formatDelta(metric.delta)} WoW</span>
          </div>
          <p>${metric.copy}</p>
        `;
        bottomMetrics.appendChild(card);
      });
    }

    if (exportButton && !exportButton.dataset.bound) {
      exportButton.dataset.bound = "true";
      exportButton.addEventListener("click", async () => {
        const shareText = `${state.company} share of voice snapshot: score ${sovData.score}, ${sovData.sharePercent}% of tracked voice, and ${sovData.yourMentions} brand mentions this week.`;
        try {
          if (navigator.share) {
            await navigator.share({
              title: `${state.company} Share of Voice`,
              text: shareText,
            });
            return;
          }
        } catch {
          // Fall through to alert if share is unavailable or dismissed.
        }
        window.alert(shareText);
      });
    }
  }

  function setupCompanyPage() {
    const form = document.getElementById("google-auth-form");
    if (!form) return;

    const state = loadState();
    const selectedAccount = form.querySelector(`input[name="mock-account"][value="${Object.keys(mockAccounts).find((key) => mockAccounts[key].company === state.company) || "figma"}"]`);
    if (selectedAccount) {
      selectedAccount.checked = true;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const accountValue = form.querySelector('input[name="mock-account"]:checked')?.value || "figma";
      const account = mockAccounts[accountValue] || mockAccounts.figma;

      saveState({
        ...state,
        company: account.company,
        url: account.url,
        competitors: account.competitors,
        authProvider: "Google",
        authEmail: account.authEmail,
      });

      window.location.href = form.action;
    });
  }

  function setupCompetitorPage() {
    const form = document.getElementById("competitor-form");
    if (!form) return;

    const state = loadState();
    const companyInput = document.getElementById("company-name");
    const urlInput = document.getElementById("company-url");
    const competitorInputs = Array.from(document.querySelectorAll(".competitor-input"));

    companyInput.value = state.company;
    urlInput.value = state.url;
    competitorInputs.forEach((input, index) => {
      input.value = state.competitors[index] || "";
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const competitors = sanitizeCompetitors(competitorInputs.map((input) => input.value));
      if (competitors.length < 3) {
        window.alert("Enter at least three competitors to continue.");
        return;
      }

      saveState({
        ...state,
        company: companyInput.value.trim() || defaultState.company,
        url: normalizeUrl(urlInput.value),
        category: defaultState.category,
        persona: defaultState.persona,
        notes: defaultState.notes,
        competitors,
      });

      window.location.href = form.action;
    });
  }

  function setupLoadingPage() {
    const bar = document.getElementById("progress-bar");
    if (!bar) return;

    const text = document.getElementById("progress-text");
    const percent = document.getElementById("progress-percent");
    const button = document.getElementById("view-results");
    const state = loadState();

    renderText("[data-company]", state.company);

    const duration = 2800;
    const start = performance.now();
    text.textContent = "Preparing your dashboard";

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const pct = Math.round(eased * 100);

      bar.style.width = `${pct}%`;
      percent.textContent = `${pct}%`;

      if (progress < 1) {
        window.requestAnimationFrame(tick);
        return;
      }

      percent.textContent = "100%";
      if (button) {
        button.classList.remove("is-hidden");
      }
    }

    window.requestAnimationFrame(tick);
  }

  function setupSharePreviewPage() {
    const sharePage = document.querySelector(".share-preview-page");
    if (!sharePage) return;

    const state = loadState();
    renderText("[data-company]", state.company);
  }

  function setupResultsPage() {
    const leaderboard = document.getElementById("leaderboard");
    if (!leaderboard) return;

    const state = loadState();
    const dataset = buildDataset(state);
    const companyRow = dataset.find((entry) => entry.name === state.company) || dataset[0];
    const companyRank = dataset.findIndex((entry) => entry.name === state.company) + 1;
    const reviewGrid = document.getElementById("review-grid");
    const llmGrid = document.getElementById("llm-grid");
    const trendChart = document.getElementById("trend-chart");
    const trendLegend = document.getElementById("trend-legend");

    renderText("[data-company]", state.company);

    setTextIfPresent("url-chip", shortUrl(state.url));
    setTextIfPresent("category-chip", state.category);
    setTextIfPresent("persona-chip", state.persona);
    setTextIfPresent("overall-score", `${companyRow.composite}%`);
    setTextIfPresent("overall-rank", `Ranked #${companyRank} of ${dataset.length}`);
    setTextIfPresent("summary-copy", `${state.company} is benchmarked against ${state.competitors
      .slice(0, 4)
      .join(", ")} across awareness, share of voice, reviews, and LLM search visibility.`);
    setTextIfPresent("home-summary-copy", `${state.company} is currently ${companyRank === 1 ? "leading" : `ranked #${companyRank}`} in the peer set, with ${companyRow.llmVisibility}% LLM visibility and ${companyRow.social}% social share of voice.`);
    setTextIfPresent("notes-copy", state.notes || defaultState.notes);

    const topBrand = dataset[0];
    const rankLead = topBrand.name === state.company ? "You lead the current benchmark across the set." : `${topBrand.name} currently leads the set.`;
    setTextIfPresent("headline-text",
      companyRow.llmVisibility >= companyRow.unaided
        ? "Digital discovery is outperforming traditional awareness."
        : "Awareness is solid, but digital discovery is lagging behind recall.");
    setTextIfPresent("insight-copy", `${rankLead} ${state.company} scores ${companyRow.unaided}% unaided recall, ${companyRow.social}% social share of voice, and ${companyRow.llmVisibility}% LLM visibility in this simulated run.`);

    leaderboard.innerHTML = `
      <table class="leader-table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Brand</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    const leaderboardBody = leaderboard.querySelector("tbody");
    dataset.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>#${index + 1}</td>
        <td class="${entry.name === state.company ? "leader-brand-self" : ""}">${entry.name}</td>
        <td>${entry.composite}</td>
      `;
      leaderboardBody.appendChild(row);
    });

    const reviewBenchmarks = [
      {
        title: "G2",
        primary: `${companyRow.g2Score.toFixed(1)} / 5`,
        secondary: `${topBrand.name} leads at ${topBrand.g2Score.toFixed(1)} / 5`,
      },
      {
        title: "Capterra",
        primary: `${companyRow.capterraScore.toFixed(1)} / 5`,
        secondary: `${topBrand.name} posts ${topBrand.capterraScore.toFixed(1)} / 5`,
      },
      {
        title: "Review momentum",
        primary: companyRow.g2Score >= topBrand.g2Score ? "Leader tier" : "Competitive but trailing",
        secondary: "Use review proof points in executive and sales narratives",
      },
      {
        title: "Peer pressure",
        primary: `${dataset[1] ? dataset[1].name : topBrand.name} is closest on reviews`,
        secondary: "Watch for perception shifts before they hit awareness metrics",
      },
    ];

    reviewGrid.innerHTML = "";
    reviewBenchmarks.forEach((item) => {
      const card = document.createElement("article");
      card.className = "review-card";
      card.innerHTML = `<span class="mini-label">${item.title}</span><div class="review-metric"><strong>${item.primary}</strong></div><p>${item.secondary}</p>`;
      reviewGrid.appendChild(card);
    });

    const llmBenchmarks = [
      {
        title: "Category prompts",
        primary: `${Math.max(companyRow.llmVisibility - 4, 0)}%`,
        secondary: `Discovery for "${state.category}" terms`,
      },
      {
        title: "Alternative prompts",
        primary: `${Math.min(companyRow.llmVisibility + 3, 95)}%`,
        secondary: `"Best ${state.category.toLowerCase()}" and "alternatives" coverage`,
      },
      {
        title: "Head-to-head prompts",
        primary: `${Math.max(companyRow.llmVisibility - 8, 0)}%`,
        secondary: `${state.company} vs ${state.competitors[0]} style comparisons`,
      },
      {
        title: "Citation quality",
        primary: companyRow.llmVisibility > 70 ? "High" : "Mixed",
        secondary: "How often the brand appears with direct product context or citations",
      },
    ];

    llmGrid.innerHTML = "";
    llmBenchmarks.forEach((item) => {
      const card = document.createElement("article");
      card.className = "llm-card";
      card.innerHTML = `<span class="mini-label">${item.title}</span><div class="llm-metric"><strong>${item.primary}</strong></div><p>${item.secondary}</p>`;
      llmGrid.appendChild(card);
    });

    renderAwarenessDashboard(state, companyRow, companyRank);
    renderSovDashboard(state, dataset, companyRow, companyRank);
    renderTrendChart(trendChart, trendLegend, dataset, state.company);
    setupDashboardTabs();
    setupDashboardFeed();
  }

  function setupDashboardFeed() {
    const feedStack = document.querySelector(".feed-stack");
    const emptyState = document.getElementById("feed-empty-state");

    function refreshEmptyState() {
      if (!feedStack || !emptyState) return;
      const visibleCards = Array.from(feedStack.querySelectorAll(".feed-card")).filter((card) => {
        return card !== emptyState;
      });
      emptyState.classList.toggle("is-hidden", visibleCards.length > 0);
    }

    document.querySelectorAll("[data-dismiss-card]").forEach((button) => {
      button.addEventListener("click", () => {
        const cardId = button.getAttribute("data-dismiss-card");
        const card = cardId ? document.getElementById(cardId) : button.closest(".feed-card");
        const toolbar = document.querySelector(".app-toolbar");
        const welcomeLabel = document.getElementById("welcome-label");
        if (card) {
          card.remove();
          if (cardId === "welcome-card" && welcomeLabel) {
            welcomeLabel.remove();
          }
          if (cardId === "welcome-card" && toolbar) {
            toolbar.classList.add("is-borderless");
          }
          refreshEmptyState();
        }
      });
    });

    document.querySelectorAll("[data-archive-card]").forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.closest(".feed-card");
        if (card) {
          card.remove();
          refreshEmptyState();
        }
      });
    });

    document.querySelectorAll("[data-share-card]").forEach((button) => {
      button.addEventListener("click", async () => {
        const label = button.getAttribute("data-share-card") || "Dashboard update";
        const shareText = `${label} from your SignalStack dashboard is ready to share.`;
        try {
          if (navigator.share) {
            await navigator.share({
              title: label,
              text: shareText,
            });
            return;
          }
        } catch {
          // Fall back to alert if the native share sheet is dismissed or unavailable.
        }
        window.alert(shareText);
      });
    });

    refreshEmptyState();
  }

  function renderAwarenessChart(svg, legend, dataset, companyName) {
    if (!svg || !legend) return;

    svg.innerHTML = "";
    legend.innerHTML = "";
    const left = 56;
    const right = 520;
    const bottom = 270;
    const top = 34;
    const band = (right - left) / dataset.length;
    const barWidth = 18;

    svg.appendChild(createSvgNode("line", { x1: left, y1: bottom, x2: right, y2: bottom, stroke: chartTheme.axis }));

    [0, 25, 50, 75, 100].forEach((tick) => {
      const y = bottom - ((bottom - top) * tick) / 100;
      svg.appendChild(createSvgNode("line", { x1: left, y1: y, x2: right, y2: y, stroke: chartTheme.grid }));
      const label = createSvgNode("text", { x: left - 10, y: y + 4, "text-anchor": "end", fill: chartTheme.label, "font-size": 11 });
      label.textContent = `${tick}`;
      svg.appendChild(label);
    });

    dataset.forEach((entry, index) => {
      const xCenter = left + band * index + band / 2;
      const unaidedHeight = ((bottom - top) * entry.unaided) / 100;
      const aidedHeight = ((bottom - top) * entry.aided) / 100;
      const isCompany = entry.name === companyName;
      const unaidedColor = isCompany ? chartTheme.companyAlt : chartTheme.competitor;
      const aidedColor = isCompany ? chartTheme.company : "rgba(217, 95, 57, 0.38)";

      svg.appendChild(createSvgNode("rect", {
        x: xCenter - barWidth - 4,
        y: bottom - unaidedHeight,
        width: barWidth,
        height: unaidedHeight,
        rx: 6,
        fill: unaidedColor,
      }));
      svg.appendChild(createSvgNode("rect", {
        x: xCenter + 4,
        y: bottom - aidedHeight,
        width: barWidth,
        height: aidedHeight,
        rx: 6,
        fill: aidedColor,
      }));

      const label = createSvgNode("text", {
        x: xCenter,
        y: 296,
        "text-anchor": "middle",
        fill: isCompany ? chartTheme.labelStrong : chartTheme.label,
        "font-size": 11,
      });
      label.textContent = entry.name;
      svg.appendChild(label);
    });

    [
      { label: "Unaided recall", color: chartTheme.companyAlt },
      { label: "Aided recall", color: chartTheme.company },
    ].forEach((item) => {
      const legendItem = document.createElement("span");
      legendItem.className = "legend-item";
      legendItem.innerHTML = `<span class="legend-swatch" style="background:${item.color}"></span>${item.label}`;
      legend.appendChild(legendItem);
    });
  }

  function renderTrendChart(svg, legend, dataset, companyName) {
    if (!svg || !legend) return;

    svg.innerHTML = "";
    legend.innerHTML = "";

    const topBrands = dataset.slice(0, Math.min(dataset.length, 4));
    const left = 48;
    const right = 520;
    const top = 30;
    const bottom = 270;
    const min = 45;
    const max = 95;
    const points = 6;
    const colors = [chartTheme.companyAlt, chartTheme.competitorStrong, chartTheme.warning, chartTheme.danger];

    svg.appendChild(createSvgNode("line", { x1: left, y1: bottom, x2: right, y2: bottom, stroke: chartTheme.axis }));
    svg.appendChild(createSvgNode("line", { x1: left, y1: top, x2: left, y2: bottom, stroke: chartTheme.axis }));

    [50, 60, 70, 80, 90].forEach((tick) => {
      const y = bottom - ((tick - min) / (max - min)) * (bottom - top);
      svg.appendChild(createSvgNode("line", { x1: left, y1: y, x2: right, y2: y, stroke: chartTheme.grid }));
      const label = createSvgNode("text", { x: left - 10, y: y + 4, "text-anchor": "end", fill: chartTheme.label, "font-size": 11 });
      label.textContent = `${tick}`;
      svg.appendChild(label);
    });

    const xAt = (index) => left + ((right - left) * index) / (points - 1);
    const yAt = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
    const labels = ["W1", "W2", "W3", "W4", "W5", "W6"];

    labels.forEach((item, index) => {
      const label = createSvgNode("text", {
        x: xAt(index),
        y: 296,
        "text-anchor": "middle",
        fill: chartTheme.label,
        "font-size": 11,
      });
      label.textContent = item;
      svg.appendChild(label);
    });

    topBrands.forEach((entry, index) => {
      const color = entry.name === companyName ? chartTheme.company : colors[index] || chartTheme.competitorStrong;
      const series = Array.from({ length: points }, (_, pointIndex) => {
        const drift = pointIndex - (points - 1);
        return Math.max(min, Math.min(max, entry.composite + drift * 2 + ((hash(`${entry.name}:${pointIndex}`) % 5) - 2)));
      });
      const pointString = series.map((value, pointIndex) => `${xAt(pointIndex)},${yAt(value)}`).join(" ");
      svg.appendChild(createSvgNode("polyline", {
        points: pointString,
        fill: "none",
        stroke: color,
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }));

      series.forEach((value, pointIndex) => {
        svg.appendChild(createSvgNode("circle", {
          cx: xAt(pointIndex),
          cy: yAt(value),
          r: 4,
          fill: color,
        }));
      });

      const legendItem = document.createElement("span");
      legendItem.className = "legend-item";
      legendItem.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${entry.name}`;
      legend.appendChild(legendItem);
    });
  }

  function renderSovChart(svg, legend, dataset, companyName) {
    if (!svg || !legend) return;

    svg.innerHTML = "";
    legend.innerHTML = "";

    const left = 56;
    const right = 520;
    const bottom = 280;
    const top = 34;
    const rows = dataset.length;
    const rowGap = 46;
    const trackWidth = right - left;

    dataset.forEach((entry, index) => {
      const y = top + index * rowGap;
      const value = Math.min(entry.social + entry.ads + entry.earned, 100);
      const color = entry.name === companyName ? chartTheme.company : chartTheme.competitor;

      const label = createSvgNode("text", {
        x: left,
        y: y - 8,
        fill: entry.name === companyName ? chartTheme.labelStrong : chartTheme.label,
        "font-size": 12,
      });
      label.textContent = entry.name;
      svg.appendChild(label);

      svg.appendChild(createSvgNode("rect", {
        x: left,
        y,
        width: trackWidth,
        height: 16,
        rx: 8,
        fill: chartTheme.track,
      }));

      svg.appendChild(createSvgNode("rect", {
        x: left,
        y,
        width: (trackWidth * value) / 100,
        height: 16,
        rx: 8,
        fill: color,
      }));

      const metric = createSvgNode("text", {
        x: right,
        y: y + 12,
        "text-anchor": "end",
        fill: chartTheme.labelStrong,
        "font-size": 12,
      });
      metric.textContent = `${value}%`;
      svg.appendChild(metric);
    });

    [
      { label: "Your brand", color: chartTheme.company },
      { label: "Competitors", color: chartTheme.competitor },
    ].forEach((item) => {
      const legendItem = document.createElement("span");
      legendItem.className = "legend-item";
      legendItem.innerHTML = `<span class="legend-swatch" style="background:${item.color}"></span>${item.label}`;
      legend.appendChild(legendItem);
    });
  }

  function setupDashboardTabs() {
    const buttons = Array.from(document.querySelectorAll("[data-tab-target]"));
    const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
    const heading = document.getElementById("dashboard-heading");
    const summary = document.getElementById("summary-copy");
    if (!buttons.length || !panels.length) return;
    const overviewSummary = summary?.textContent || "Catch up on what changed, what needs attention, and what is ready to share out.";

    const headingsByTab = {
      overview: "Hiya! \uD83D\uDC4B",
      awareness: "Awareness",
      sov: "Share of Voice",
      "reviews-llm": "Reviews & LLM",
    };

    const summariesByTab = {
      overview: overviewSummary,
      awareness: "A cleaner read on brand momentum, audience return behavior, and top-line demand signals.",
      sov: "Understand where your share is coming from across channels and competitors.",
      "reviews-llm": "Track how reputation and AI discovery are shaping perception.",
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.getAttribute("data-tab-target");

        buttons.forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-selected", active ? "true" : "false");
        });

        panels.forEach((panel) => {
          const active = panel.getAttribute("data-tab-panel") === target;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });

        if (heading) {
          heading.textContent = headingsByTab[target] || "Hiya! \uD83D\uDC4B";
        }

        if (summary) {
          summary.textContent = summariesByTab[target] || summariesByTab.overview;
        }
      });
    });
  }

  setupCompanyPage();
  setupCompetitorPage();
  setupLoadingPage();
  setupResultsPage();
  setupSharePreviewPage();
})();
