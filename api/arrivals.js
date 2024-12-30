import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { stopCode } = req.query;

  if (!stopCode) {
    return res.status(400).json({ error: 'Missing stopCode parameter' });
  }

  const API_KEY = process.env.MTA_API_KEY;
  const URL = `https://bustime.mta.info/api/siri/stop-monitoring.json?key=${API_KEY}&MonitoringRef=${stopCode}`;

  try {
    const response = await fetch(URL);
    const data = await response.json();

    // Check for bus times
    const stopMonitoringDelivery = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0];
    const monitoredVehicles = stopMonitoringDelivery?.MonitoredStopVisit || [];

    if (monitoredVehicles.length > 0) {
      const busTimes = monitoredVehicles.map((visit) => {
        const monitoredVehicleJourney = visit.MonitoredVehicleJourney;
        return {
          route: monitoredVehicleJourney.LineRef,
          destination: monitoredVehicleJourney.DestinationName,
          expectedArrival: monitoredVehicleJourney.MonitoredCall?.ExpectedArrivalTime,
        };
      });

      return res.status(200).json({ busTimes });
    }

    // Check for situation messages
    const situationExchangeDelivery = data?.Siri?.ServiceDelivery?.SituationExchangeDelivery?.[0];
    const situations = situationExchangeDelivery?.Situations?.PtSituationElement || [];

    if (situations.length > 0) {
      const messages = situations.map((situation) => ({
        summary: situation.Summary,
        description: situation.Description,
        affects: situation.Affects?.VehicleJourneys?.AffectedVehicleJourney || [],
        creationTime: situation.CreationTime,
      }));

      return res.status(200).json({ messages });
    }

    // Default response if no bus times or messages
    return res.status(200).json({ message: 'No bus times or situations available at this stop.' });

  } catch (error) {
    console.error('Error fetching bus data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
