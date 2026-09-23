export interface AppConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  overpassUrl: string;
  overpassMirrors: string[];
  aqiApiUrl: string;
  osrmUrl: string;
}

export default (): { app: AppConfig } => {
  const overpassUrl =
    process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

  return {
    app: {
      port: parseInt(process.env.PORT ?? '3000', 10),
      host: process.env.HOST ?? '0.0.0.0',
      corsOrigins: (process.env.CORS_ORIGINS ??
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173'
      )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      overpassUrl,
      overpassMirrors: [
        overpassUrl,
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass-api.de/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ].filter((url, index, all) => all.indexOf(url) === index),
      aqiApiUrl:
        process.env.AQI_API_URL ??
        'https://air-quality-api.open-meteo.com/v1/air-quality',
      osrmUrl: process.env.OSRM_URL ?? 'https://router.project-osrm.org',
    },
  };
};
