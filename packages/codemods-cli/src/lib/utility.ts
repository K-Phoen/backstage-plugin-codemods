import path from 'path';
import * as winston from 'winston';
import { ConfigReader } from '@backstage/config';
import { loadConfig } from '@backstage/config-loader';

const customFormat = winston.format.printf(
  ({ level, message, component, timestamp }) => {
    return `${timestamp} [${component}] ${level}: ${message}`;
  },
);

export const createLogger = ({
  verbose = false,
}: {
  verbose: boolean;
}): winston.Logger => {
  const logger = winston.createLogger({
    level: verbose ? 'verbose' : 'info',
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          customFormat,
        ),
      }),
    ],
  });

  return logger;
};

export const loadConfigFile = async ({
  configFile,
}: {
  configFile: string;
}): Promise<ConfigReader> => {
  const configPath = path.resolve(configFile);
  const { appConfigs } = await loadConfig({
    configRoot: path.dirname(configPath),
    configTargets: [{ path: configPath }],
  });

  return ConfigReader.fromConfigs(appConfigs);
};
