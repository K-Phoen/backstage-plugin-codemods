import * as winston from 'winston';

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
