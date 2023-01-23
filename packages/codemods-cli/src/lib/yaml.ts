import { readFile } from 'fs/promises';
import yaml from 'yaml';

export const parseYamlFile = async <T = any>(filePath: string): Promise<T> => {
  const yamlContent = await readFile(filePath);

  const parsedCodemod = yaml.parseDocument(yamlContent.toString());

  return parsedCodemod.toJSON();
};
