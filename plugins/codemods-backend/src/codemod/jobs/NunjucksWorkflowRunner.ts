import { JobContext, WorkflowResponse, WorkflowRunner } from './types';
import * as winston from 'winston';
import fs from 'fs-extra';
import path from 'path';
import nunjucks from 'nunjucks';
import { JsonObject, JsonValue } from '@backstage/types';
import { InputError } from '@backstage/errors';
import { PassThrough } from 'stream';
import { isTruthy } from './helper';
import { validate as validateJsonSchema } from 'jsonschema';
import { CodemodActionRegistry } from '../actions';
import {
  TemplateFilter,
  SecureTemplater,
  SecureTemplateRenderer,
  TemplateGlobal,
} from '../../lib/templating/SecureTemplater';
import { Entity, UserEntity } from '@backstage/catalog-model';
import {
  JobSpec,
  JobSpecV1alpha1,
  JobStep,
} from '@k-phoen/plugin-codemods-common';

type NunjucksWorkflowRunnerOptions = {
  workingDirectory: string;
  actionRegistry: CodemodActionRegistry;
  logger: winston.Logger;
  additionalTemplateFilters?: Record<string, TemplateFilter>;
  additionalTemplateGlobals?: Record<string, TemplateGlobal>;
};

type TemplateContext = {
  parameters: JsonObject;
  steps: {
    [stepName: string]: { output: { [outputName: string]: JsonValue } };
  };
  target: {
    entity: Entity;
    ref: string;
  };
  user?: {
    entity?: UserEntity;
    ref?: string;
  };
};

const isValidJobSpec = (jobSpec: JobSpec): jobSpec is JobSpecV1alpha1 => {
  return jobSpec.codemod.apiVersion === 'codemod.backstage.io/v1alpha1';
};

const createStepLogger = ({
  job,
  step,
}: {
  job: JobContext;
  step: JobStep;
}) => {
  const metadata = { stepId: step.id };
  const taskLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
    defaultMeta: {},
  });

  const streamLogger = new PassThrough();
  streamLogger.on('data', async data => {
    const message = data.toString().trim();
    if (message?.length > 1) {
      await job.emitLog(message, metadata);
    }
  });

  taskLogger.add(new winston.transports.Stream({ stream: streamLogger }));

  return { taskLogger, streamLogger };
};

export class NunjucksWorkflowRunner implements WorkflowRunner {
  constructor(private readonly options: NunjucksWorkflowRunnerOptions) {}

  private isSingleTemplateString(input: string) {
    const { parser, nodes } = nunjucks as unknown as {
      parser: {
        parse(
          template: string,
          ctx: object,
          options: nunjucks.ConfigureOptions,
        ): { children: { children?: unknown[] }[] };
      };
      nodes: { TemplateData: Function };
    };

    const parsed = parser.parse(
      input,
      {},
      {
        autoescape: false,
        tags: {
          variableStart: '${{',
          variableEnd: '}}',
        },
      },
    );

    return (
      parsed.children.length === 1 &&
      !(parsed.children[0]?.children?.[0] instanceof nodes.TemplateData)
    );
  }

  private render<T>(
    input: T,
    context: TemplateContext,
    renderTemplate: SecureTemplateRenderer,
  ): T {
    return JSON.parse(JSON.stringify(input), (_key, value) => {
      try {
        if (typeof value === 'string') {
          try {
            if (this.isSingleTemplateString(value)) {
              // Lets convert ${{ parameters.bob }} to ${{ (parameters.bob) | dump }} so we can keep the input type
              const wrappedDumped = value.replace(
                /\${{(.+)}}/g,
                '${{ ( $1 ) | dump }}',
              );

              // Run the templating
              const templated = renderTemplate(wrappedDumped, context);

              // If there's an empty string returned, then it's undefined
              if (templated === '') {
                return undefined;
              }

              // Reparse the dumped string
              return JSON.parse(templated);
            }
          } catch (ex) {
            this.options.logger.error(
              `Failed to parse template string: ${value} with error ${ex.message}`,
            );
          }

          // Fallback to default behaviour
          const templated = renderTemplate(value, context);

          if (templated === '') {
            return undefined;
          }

          return templated;
        }
      } catch {
        return value;
      }
      return value;
    });
  }

  async execute(job: JobContext): Promise<WorkflowResponse> {
    if (!isValidJobSpec(job.spec)) {
      throw new InputError(
        'Wrong template version executed with the workflow engine',
      );
    }
    const workspacePath = path.join(
      this.options.workingDirectory,
      await job.getWorkspaceName(),
    );

    const renderTemplate = await SecureTemplater.loadRenderer({
      additionalTemplateFilters: this.options.additionalTemplateFilters,
      additionalTemplateGlobals: this.options.additionalTemplateGlobals,
    });

    try {
      await fs.ensureDir(workspacePath);

      const context: TemplateContext = {
        parameters: job.spec.codemod.parameters,
        steps: {},
        user: job.spec.codemod.user,
        target: {
          entity: job.target,
          ref: job.spec.targetRef,
        },
      };

      for (const step of job.spec.codemod.steps) {
        await job.emitLog(`Beginning step ${step.name}`, {
          stepId: step.id,
          status: 'processing',
        });

        try {
          if (step.if) {
            const ifResult = await this.render(
              step.if,
              context,
              renderTemplate,
            );
            if (!isTruthy(ifResult)) {
              await job.emitLog(
                `Skipping step ${step.id} because its if condition was false`,
                { stepId: step.id, status: 'skipped' },
              );
              continue;
            }
          }

          const action = this.options.actionRegistry.get(step.action);
          const { taskLogger, streamLogger } = createStepLogger({ job, step });

          const input =
            (step.input &&
              this.render(step.input, { ...context }, renderTemplate)) ??
            {};

          if (action.schema?.input) {
            const validateResult = validateJsonSchema(
              input,
              action.schema.input,
            );
            if (!validateResult.valid) {
              const errors = validateResult.errors.join(', ');
              throw new InputError(
                `Invalid input passed to action ${action.id}, ${errors}`,
              );
            }
          }

          const tmpDirs = new Array<string>();
          const stepOutput: { [outputName: string]: JsonValue } = {};

          await action.handler({
            input,
            logger: taskLogger,
            logStream: streamLogger,
            workspacePath,
            createTemporaryDirectory: async () => {
              const tmpDir = await fs.mkdtemp(
                `${workspacePath}_step-${step.id}-`,
              );
              tmpDirs.push(tmpDir);
              return tmpDir;
            },
            output(name: string, value: JsonValue) {
              stepOutput[name] = value;
            },
            codemodInfo: job.spec.codemod.codemodInfo,
            target: {
              entity: job.target,
              ref: job.spec.targetRef,
            },
            user: job.spec.codemod.user,
          });

          // Remove all temporary directories that were created when executing the action
          for (const tmpDir of tmpDirs) {
            await fs.remove(tmpDir);
          }

          context.steps[step.id] = { output: stepOutput };

          await job.emitLog(`Finished step ${step.name}`, {
            stepId: step.id,
            status: 'completed',
          });
        } catch (err) {
          await job.emitLog(String(err.stack), {
            stepId: step.id,
            status: 'failed',
          });
          throw err;
        }
      }

      if (!job.spec.codemod.output) {
        return { output: {} };
      }

      const output = this.render(
        job.spec.codemod.output,
        context,
        renderTemplate,
      );

      return { output };
    } finally {
      if (workspacePath) {
        await fs.remove(workspacePath);
      }
    }
  }
}
