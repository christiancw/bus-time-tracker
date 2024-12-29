const axios = require('axios');

export default async function handler(req, res) {
    const { stopCode } = req.query;

    if (!stopCode) {
        return res.status(400).json({ error: 'Missing stopCode parameter.' });
    }

    try {
        const response = await axios.get('https://bustime.mta.info/api/siri/stop-monitoring.json', {
            params: {
                key: process.env.MTA_API_KEY,
                MonitoringRef: stopCode,
            },
        });

        const data = response.data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
        if (!data || data.length === 0) {
            return res.json({ message: 'No buses arriving soon.' });
        }

        const arrivals = data.map((bus) => ({
            route: bus.MonitoredVehicleJourney.LineRef,
            destination: bus.MonitoredVehicleJourney.DestinationName,
            expectedArrival: bus.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime,
        }));

        res.json(arrivals);
    } catch (error) {
        console.error('Error fetching bus data:', error.message);
        res.status(500).json({ error: 'Failed to fetch bus data.' });
    }
}
