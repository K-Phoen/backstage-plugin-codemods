import { resolvePackagePath } from '@backstage/backend-common';
import { JsonValue } from '@backstage/types';
import fs from 'fs-extra';
import { VM } from 'vm2';

// language=JavaScript
const mkScript = (nunjucksSource: string) => `
const { render } = (() => {
  const module = {};
  const process = { env: {} };
  const require = (pkg) => { if (pkg === 'events') { return function (){}; }};

  ${nunjucksSource}

  const env = module.exports.configure({
    autoescape: false,
    tags: {
      variableStart: '\${{',
      variableEnd: '}}',
    },
  });

  const compatEnv = module.exports.configure({
    autoescape: false,
    tags: {
      variableStart: '{{',
      variableEnd: '}}',
    },
  });
  compatEnv.addFilter('jsonify', compatEnv.getFilter('dump'));

  if (typeof parseRepoUrl !== 'undefined') {
    const safeHelperRef = parseRepoUrl;

    env.addFilter('parseRepoUrl', repoUrl => {
      return JSON.parse(safeHelperRef(repoUrl))
    });
    env.addFilter('projectSlug', repoUrl => {
      const { owner, repo } = JSON.parse(safeHelperRef(repoUrl));
      return owner + '/' + repo;
    });
  }

  if (typeof additionalTemplateFilters !== 'undefined') {
    for (const [filterName, filterFn] of Object.entries(additionalTemplateFilters)) {
      env.addFilter(filterName, (...args) => JSON.parse(filterFn(...args)));
    }
  }

  if (typeof additionalTemplateGlobals !== 'undefined') {
    for (const [globalName, global] of Object.entries(additionalTemplateGlobals)) {
      if (typeof global === 'function') {
        env.addGlobal(globalName, (...args) => JSON.parse(global(...args)));
      } else {
        env.addGlobal(globalName, JSON.parse(global));
      }
    }
  }

  function render(str, values) {
    try {
      return env.renderString(str, JSON.parse(values));
    } catch (error) {
      // Make sure errors don't leak anything
      throw new Error(String(error.message));
    }
  }

  return { render };
})();
`;

/** @public */
export type TemplateFilter = (...args: JsonValue[]) => JsonValue | undefined;

/** @public */
export type TemplateGlobal =
  | ((...args: JsonValue[]) => JsonValue | undefined)
  | JsonValue;

export interface SecureTemplaterOptions {
  /* Extra user-provided nunjucks filters */
  additionalTemplateFilters?: Record<string, TemplateFilter>;
  /* Extra user-provided nunjucks globals */
  additionalTemplateGlobals?: Record<string, TemplateGlobal>;
}

export type SecureTemplateRenderer = (
  template: string,
  values: unknown,
) => string;

export class SecureTemplater {
  static async loadRenderer(options: SecureTemplaterOptions = {}) {
    const { additionalTemplateFilters, additionalTemplateGlobals } = options;
    const sandbox: Record<string, any> = {};

    if (additionalTemplateFilters) {
      sandbox.additionalTemplateFilters = Object.fromEntries(
        Object.entries(additionalTemplateFilters)
          .filter(([_, filterFunction]) => !!filterFunction)
          .map(([filterName, filterFunction]) => [
            filterName,
            (...args: JsonValue[]) => JSON.stringify(filterFunction(...args)),
          ]),
      );
    }
    if (additionalTemplateGlobals) {
      sandbox.additionalTemplateGlobals = Object.fromEntries(
        Object.entries(additionalTemplateGlobals)
          .filter(([_, global]) => !!global)
          .map(([globalName, global]) => {
            if (typeof global === 'function') {
              return [
                globalName,
                (...args: JsonValue[]) => JSON.stringify(global(...args)),
              ];
            }
            return [globalName, JSON.stringify(global)];
          }),
      );
    }
    const vm = new VM({ sandbox });

    const nunjucksSource = await fs.readFile(
      resolvePackagePath(
        '@k-phoen/plugin-codemods-backend',
        'assets/nunjucks.js.txt',
      ),
      'utf-8',
    );

    vm.run(mkScript(nunjucksSource));

    const render: SecureTemplateRenderer = (template, values) => {
      if (!vm) {
        throw new Error('SecureTemplater has not been initialized');
      }
      vm.setGlobal('templateStr', template);
      vm.setGlobal('templateValues', JSON.stringify(values));

      return vm.run(`render(templateStr, templateValues)`);
    };
    return render;
  }
}
