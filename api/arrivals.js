export default async function handler(req, res) {
    const { stopCode } = req.query;

    if (!stopCode) {
        return res.status(400).json({ error: 'Missing stopCode parameter.' });
    }

    try {
        const response = await fetch(`https://bustime.mta.info/api/siri/stop-monitoring.json?key=${process.env.MTA_API_KEY}&MonitoringRef=${stopCode}`);
        const data = await response.json();

        console.log('API Response:', JSON.stringify(data, null, 2)); // Log the entire response for debugging

        // const buses = data.Siri.ServiceDelivery.StopMonitoringDelivery[0]?.MonitoredStopVisit || [];
        
        const buses = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
            if (buses.length === 0) {
    return res.status(404).json({ message: 'No buses found for this stop.' });
        }

        const arrivals = buses.map((bus) => ({
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
