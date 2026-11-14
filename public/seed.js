// Seed/demo data for Eve web prototype (Phase 1)
// User: Jane, Calgary-style context. Reference week includes Nov 14, 2026 (Sat).
(function () {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;
  // Anchor "today" to Sat Nov 14, 2026 local noon for stable demo labels.
  const TODAY = new Date(2026, 10, 14, 12, 0, 0, 0); // month 10 = November
  const todayTs = (h, m, dayOffset = 0) => {
    const d = new Date(TODAY.getTime() + dayOffset * DAY);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  const PLACES = {
    bow: { id: 'bow', name: 'Bow River pathway', lat: 51.053, lng: -114.07, x: 38, y: 42 },
    office: { id: 'office', name: 'Downtown office', lat: 51.046, lng: -114.06, x: 56, y: 48 },
    home: { id: 'home', name: 'Home', lat: 51.038, lng: -114.045, x: 62, y: 72 },
    underpass: { id: 'underpass', name: '9th Ave underpass', lat: 51.042, lng: -114.052, x: 58, y: 60 },
    kensington: { id: 'kensington', name: 'Kensington cafe', lat: 51.052, lng: -114.085, x: 28, y: 40 },
    seventeenth: { id: 'seventeenth', name: '17 Ave bus stop', lat: 51.037, lng: -114.075, x: 34, y: 74 },
    gym: { id: 'gym', name: 'Riverside gym', lat: 51.05, lng: -114.065, x: 44, y: 46 },
    market: { id: 'market', name: 'Farmers market', lat: 51.048, lng: -114.058, x: 50, y: 52 },
  };

  // Build 71 moments for the current week (Mon Nov 9 .. Sun Nov 15 window, focus on recent 7 days ending Sat)
  // Distribution: 29 good, 38 bad, 4 unsafe. Times spread across morning/midday/afternoon/evening.
  let mid = 1;
  const m = (o) => ({
    id: 'm' + (mid++),
    spikeId: 'seed-' + (mid - 1),
    tag: o.tag, // good | bad | unsafe | untagged
    placeId: o.placeId,
    placeName: PLACES[o.placeId].name,
    lat: PLACES[o.placeId].lat,
    lng: PLACES[o.placeId].lng,
    ts: o.ts,
    timeLabel: o.timeLabel,
    note: o.note || '',
    shareReason: o.shareReason || null,
    shared: !!o.shared,
    hrPeak: o.hrPeak || (o.tag === 'good' ? 118 : o.tag === 'bad' ? 124 : 132),
  });

  const weekMoments = [];
  // Good (29) - joy often outside before 9am (Bow River pathway, gym)
  const goodPlan = [
    { placeId: 'bow', d: -6, h: 7, m: 20 }, { placeId: 'bow', d: -5, h: 7, m: 10 },
    { placeId: 'bow', d: -4, h: 7, m: 35 }, { placeId: 'bow', d: -3, h: 7, m: 5 },
    { placeId: 'bow', d: -2, h: 7, m: 40 }, { placeId: 'bow', d: -1, h: 7, m: 15 },
    { placeId: 'bow', d: 0, h: 7, m: 25 }, { placeId: 'bow', d: -6, h: 8, m: 5 },
    { placeId: 'bow', d: -4, h: 8, m: 10 }, { placeId: 'gym', d: -5, h: 18, m: 30 },
    { placeId: 'gym', d: -3, h: 18, m: 20 }, { placeId: 'gym', d: -1, h: 18, m: 40 },
    { placeId: 'gym', d: -6, h: 17, m: 50 }, { placeId: 'gym', d: -2, h: 17, m: 45 },
    { placeId: 'kensington', d: -6, h: 10, m: 30 }, { placeId: 'kensington', d: -1, h: 11, m: 0 },
    { placeId: 'kensington', d: 0, h: 10, m: 15 }, { placeId: 'market', d: -6, h: 9, m: 30 },
    { placeId: 'market', d: 0, h: 9, m: 10 }, { placeId: 'market', d: -2, h: 12, m: 20 },
    { placeId: 'home', d: -5, h: 20, m: 0 }, { placeId: 'home', d: -3, h: 19, m: 30 },
    { placeId: 'home', d: -1, h: 20, m: 15 }, { placeId: 'office', d: -4, h: 15, m: 0 },
    { placeId: 'office', d: -2, h: 14, m: 30 }, { placeId: 'bow', d: -3, h: 8, m: 20 },
    { placeId: 'gym', d: 0, h: 12, m: 30 }, { placeId: 'kensington', d: -3, h: 13, m: 0 },
    { placeId: 'home', d: 0, h: 8, m: 50 },
  ];
  goodPlan.forEach((p) => weekMoments.push(m({ tag: 'good', placeId: p.placeId, ts: todayTs(p.h, p.m, p.d) })));

  // Bad (38) - drained often at office/commute midday-afternoon
  const badPlan = [
    { placeId: 'office', d: -6, h: 9, m: 30 }, { placeId: 'office', d: -6, h: 14, m: 0 },
    { placeId: 'office', d: -5, h: 10, m: 0 }, { placeId: 'office', d: -5, h: 13, m: 30 },
    { placeId: 'office', d: -5, h: 16, m: 0 }, { placeId: 'office', d: -4, h: 9, m: 15 },
    { placeId: 'office', d: -4, h: 11, m: 45 }, { placeId: 'office', d: -4, h: 14, m: 30 },
    { placeId: 'office', d: -3, h: 10, m: 30 }, { placeId: 'office', d: -3, h: 13, m: 0 },
    { placeId: 'office', d: -3, h: 15, m: 30 }, { placeId: 'office', d: -2, h: 9, m: 45 },
    { placeId: 'office', d: -2, h: 11, m: 0 }, { placeId: 'office', d: -2, h: 16, m: 30 },
    { placeId: 'office', d: -1, h: 10, m: 15 }, { placeId: 'office', d: -1, h: 14, m: 0 },
    { placeId: 'office', d: 0, h: 11, m: 30 }, { placeId: 'office', d: 0, h: 13, m: 45 },
    { placeId: 'seventeenth', d: -5, h: 17, m: 40 }, { placeId: 'seventeenth', d: -4, h: 17, m: 50 },
    { placeId: 'seventeenth', d: -3, h: 17, m: 35 }, { placeId: 'seventeenth', d: -2, h: 18, m: 0 },
    { placeId: 'seventeenth', d: -1, h: 17, m: 45 }, { placeId: 'seventeenth', d: -6, h: 18, m: 10 },
    { placeId: 'underpass', d: -4, h: 8, m: 30 }, { placeId: 'underpass', d: -2, h: 8, m: 40 },
    { placeId: 'market', d: -6, h: 13, m: 0 }, { placeId: 'market', d: -1, h: 13, m: 30 },
    { placeId: 'kensington', d: -5, h: 15, m: 30 }, { placeId: 'home', d: -4, h: 22, m: 0 },
    { placeId: 'home', d: -2, h: 21, m: 30 }, { placeId: 'office', d: -6, h: 16, m: 45 },
    { placeId: 'office', d: -1, h: 16, m: 10 }, { placeId: 'seventeenth', d: 0, h: 8, m: 20 },
    { placeId: 'office', d: -3, h: 9, m: 0 }, { placeId: 'office', d: -5, h: 11, m: 30 },
    { placeId: 'underpass', d: -1, h: 8, m: 35 }, { placeId: 'office', d: 0, h: 10, m: 0 },
  ];
  badPlan.forEach((p) => weekMoments.push(m({ tag: 'bad', placeId: p.placeId, ts: todayTs(p.h, p.m, p.d) })));

  // Unsafe (4) - 3 on walk home from office near 9th Ave underpass, all after 8pm; 1 other
  weekMoments.push(m({ tag: 'unsafe', placeId: 'underpass', ts: todayTs(20, 40, -1), note: 'being followed', shareReason: 'followed', shared: true, timeLabel: 'Fri 8:40 pm' }));
  weekMoments.push(m({ tag: 'unsafe', placeId: 'underpass', ts: todayTs(21, 10, -3), note: 'poor lighting', shareReason: 'lighting', shared: true }));
  weekMoments.push(m({ tag: 'unsafe', placeId: 'underpass', ts: todayTs(20, 55, -5), note: 'nobody around', shareReason: 'isolated', shared: true }));
  weekMoments.push(m({ tag: 'unsafe', placeId: 'seventeenth', ts: todayTs(19, 20, -2), note: 'harassment', shareReason: 'harassment', shared: false }));

  // Some earlier month moments for month view/story (simple additions)
  const monthExtras = [
    m({ tag: 'good', placeId: 'bow', ts: todayTs(7, 30, -10) }),
    m({ tag: 'good', placeId: 'bow', ts: todayTs(7, 20, -12) }),
    m({ tag: 'good', placeId: 'gym', ts: todayTs(18, 0, -11) }),
    m({ tag: 'bad', placeId: 'office', ts: todayTs(14, 0, -10) }),
    m({ tag: 'bad', placeId: 'office', ts: todayTs(15, 0, -13) }),
    m({ tag: 'bad', placeId: 'seventeenth', ts: todayTs(17, 40, -14) }),
    m({ tag: 'unsafe', placeId: 'underpass', ts: todayTs(21, 0, -15), note: 'poor lighting', shareReason: 'lighting', shared: true }),
  ];

  const moments = [...monthExtras, ...weekMoments].sort((a, b) => a.ts - b.ts);

  const communitySpots = [
    { id: 'c1', segmentId: 'seg-underpass', name: '9th Ave underpass', lat: 51.042, lng: -114.052, reason: 'Poor lighting', reasonKey: 'lighting', timeAgo: '2 days ago', distance: '0.4 km', helpful: 12, thanksSent: false, reporters: 12, peak: 'after 8 pm', topReasons: [{ label: 'Poor lighting', count: 7 }, { label: 'Nobody around', count: 5 }] },
    { id: 'c2', segmentId: 'seg-17bus', name: '17 Ave bus stop', lat: 51.037, lng: -114.075, reason: 'Harassment', reasonKey: 'harassment', timeAgo: '5 days ago', distance: '0.8 km', helpful: 8, thanksSent: false, reporters: 5, peak: 'evening', topReasons: [{ label: 'Harassment', count: 3 }, { label: 'Nobody around', count: 2 }] },
    { id: 'c3', segmentId: 'seg-riverpath', name: 'River path south entrance', lat: 51.049, lng: -114.063, reason: 'Nobody around', reasonKey: 'isolated', timeAgo: '1 day ago', distance: '0.6 km', helpful: 6, thanksSent: false, reporters: 4, peak: 'after 9 pm', topReasons: [{ label: 'Nobody around', count: 4 }] },
    { id: 'c4', segmentId: 'seg-stephen', name: 'Stephen Ave & 1 St SW', lat: 51.0462, lng: -114.0652, reason: 'Harassment', reasonKey: 'harassment', timeAgo: '3 days ago', distance: '0.5 km', helpful: 7, thanksSent: false, reporters: 6, peak: 'after 10 pm', topReasons: [{ label: 'Harassment', count: 4 }, { label: 'Nobody around', count: 2 }] },
    { id: 'c5', segmentId: 'seg-eauclaire', name: 'Eau Claire promenade', lat: 51.0538, lng: -114.0715, reason: 'Poor lighting', reasonKey: 'lighting', timeAgo: '4 days ago', distance: '0.9 km', helpful: 5, thanksSent: false, reporters: 4, peak: 'after 9 pm', topReasons: [{ label: 'Poor lighting', count: 3 }, { label: 'Nobody around', count: 1 }] },
    { id: 'c6', segmentId: 'seg-beltline', name: 'Beltline lane near 12 Ave SW', lat: 51.0412, lng: -114.0735, reason: 'Poor lighting', reasonKey: 'lighting', timeAgo: '6 days ago', distance: '0.7 km', helpful: 9, thanksSent: false, reporters: 7, peak: 'after 8 pm', topReasons: [{ label: 'Poor lighting', count: 5 }, { label: 'Nobody around', count: 2 }] },
  ];

  const communityZones = [
    { id: 'z1', name: '9th Ave underpass', lat: 51.042, lng: -114.052, radius: 180, reporters: 12, peak: 'after 8 pm' },
    { id: 'z2', name: '17 Ave bus stop', lat: 51.037, lng: -114.075, radius: 150, reporters: 5, peak: 'evening' },
    { id: 'z3', name: 'River path south entrance', lat: 51.049, lng: -114.063, radius: 150, reporters: 4, peak: 'after 9 pm' },
    { id: 'z4', name: 'Stephen Ave & 1 St SW', lat: 51.0462, lng: -114.0652, radius: 160, reporters: 6, peak: 'after 10 pm' },
    { id: 'z5', name: 'Eau Claire promenade', lat: 51.0538, lng: -114.0715, radius: 170, reporters: 4, peak: 'after 9 pm' },
    { id: 'z6', name: 'Beltline lane near 12 Ave SW', lat: 51.0412, lng: -114.0735, radius: 150, reporters: 7, peak: 'after 8 pm' },
  ];

  const routes = {
    homeFromOffice: {
      id: 'r-home-office',
      name: 'Walk home from the office',
      from: 'Downtown office',
      to: 'Home',
      usual: {
        timeMin: 18,
        label: 'Usual route',
        note: 'Passes the underpass near 9th Ave',
        path: [
          [51.046, -114.06],
          [51.0445, -114.058],
          [51.043, -114.056],
          [51.042, -114.052], // underpass area
          [51.0405, -114.049],
          [51.039, -114.047],
          [51.038, -114.045],
        ],
        type: 'usual',
      },
      calmer: {
        timeMin: 22,
        delta: '+4 min',
        label: 'Calmer route',
        why: 'Well lit, shops open, no reports',
        path: [
          [51.046, -114.06],
          [51.047, -114.064],
          [51.0455, -114.067],
          [51.043, -114.063],
          [51.0405, -114.056],
          [51.039, -114.05],
          [51.038, -114.045],
        ],
        type: 'calmer',
      },
      flaggedZone: { lat: 51.042, lng: -114.052, radius: 140 },
      unsafeCount: 3,
      allAfter8pm: true,
    },
  };

  const impact = {
    helpfulCount: 9,
    spotsShared: 3,
    thanksReceived: 4,
    latestNote: 'Took the lit street because of you. Thank you!',
  };

  window.EVE_SEED = {
    user: { name: 'Jane', watchConnected: true },
    today: TODAY.toISOString(),
    places: PLACES,
    moments,
    communitySpots,
    communityZones,
    routes,
    impact,
    thankYouPresets: [
      { id: 'p1', text: 'Took the lit street because of you. Thank you!' },
      { id: 'p2', text: 'You helped me get home safe.' },
      { id: 'p3', text: 'Thank you for looking out for us.' },
    ],
  };
})();
