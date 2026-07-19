import fetch from 'node-fetch';

const MY_SECRET_KEY = process.env.MY_SECRET_KEY || 'MY_SECRET_KEY';

// Shortcut-friendly bus-arrivals endpoint.
//
// GET /api/next-bus?stopCode=MTA_305439&token=<MY_SECRET_KEY>
//   Optional: &route=B63   filter to a single route (matches PublishedLineName)
//             &limit=3      max number of arrivals to return (default 5)
//             &format=text  return plain text instead of JSON (nice for Siri / notifications)
//
// Auth accepts either the `Authorization: Bearer <MY_SECRET_KEY>` header or a
// `?token=<MY_SECRET_KEY>` query param, since query params are much easier to
// configure inside the Apple Shortcuts "Get Contents of URL" action.

function minutesUntil(isoTime) {
  if (!isoTime) return null;
  const ms = new Date(isoTime).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 60000);
}

export default async function handler(req, res) {
  const { authorization } = req.headers;
  const { token, stopCode, route, limit, format } = req.query;

  const authorized =
    authorization === `Bearer ${MY_SECRET_KEY}` || token === MY_SECRET_KEY;
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!stopCode) {
    return res.status(400).json({ error: 'Missing stopCode parameter' });
  }

  const API_KEY = process.env.MTA_API_KEY;
  const url =
    `https://bustime.mta.info/api/siri/stop-monitoring.json` +
    `?key=${API_KEY}&version=2&OperatorRef=MTA&MonitoringRef=${encodeURIComponent(stopCode)}`;

  const maxResults = Math.max(1, parseInt(limit, 10) || 5);
  const wantsText = format === 'text';

  try {
    const response = await fetch(url);
    const data = await response.json();

    const delivery = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0];
    const upstreamError = delivery?.ErrorCondition?.Description
      || data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]?.ErrorCondition?.Description;

    if (upstreamError) {
      const msg = `MTA upstream error: ${upstreamError}`;
      if (wantsText) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(502).end(msg);
      }
      return res.status(502).json({ error: msg });
    }

    const visits = delivery?.MonitoredStopVisit || [];

    let stopName;
    const buses = [];
    for (const visit of visits) {
      const j = visit.MonitoredVehicleJourney || {};
      const call = j.MonitoredCall || {};
      const routeName = Array.isArray(j.PublishedLineName)
        ? j.PublishedLineName[0]
        : j.PublishedLineName || j.LineRef;

      if (route && String(routeName).toLowerCase() !== String(route).toLowerCase()) {
        continue;
      }

      if (!stopName && Array.isArray(call.StopPointName)) {
        stopName = call.StopPointName[0];
      }

      const expected = call.ExpectedArrivalTime || call.AimedArrivalTime;
      buses.push({
        route: routeName,
        destination: Array.isArray(j.DestinationName) ? j.DestinationName[0] : j.DestinationName,
        minutes: minutesUntil(expected),
        stopsAway: call.NumberOfStopsAway ?? null,
        proximity: call.ArrivalProximityText || null,
        scheduled: !call.ExpectedArrivalTime,
        expectedArrival: expected || null,
      });
    }

    buses.sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));
    const trimmed = buses.slice(0, maxResults);

    const label = stopName || stopCode;
    let summary;
    if (trimmed.length === 0) {
      summary = `No buses currently approaching ${label}.`;
    } else {
      const parts = trimmed.map((b) => {
        const when = b.minutes == null ? 'unknown' : b.minutes <= 0 ? 'now' : `${b.minutes} min`;
        return b.scheduled ? `${when} (scheduled)` : when;
      });
      const routeText = trimmed[0].route ? `${trimmed[0].route} ` : '';
      summary = `${label} — ${routeText}in ${parts.join(', ')}`;
    }

    if (wantsText) {
      const lines = [summary];
      for (const b of trimmed) {
        const when = b.minutes == null ? 'unknown' : b.minutes <= 0 ? 'now' : `${b.minutes} min`;
        lines.push(`• ${b.route} → ${b.destination}: ${when}${b.proximity ? ` (${b.proximity})` : ''}`);
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).end(lines.join('\n'));
    }

    return res.status(200).json({
      stopCode,
      stopName: stopName || null,
      summary,
      count: trimmed.length,
      buses: trimmed,
    });
  } catch (error) {
    console.error('Error fetching bus data:', error);
    if (wantsText) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).end('Internal server error');
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
