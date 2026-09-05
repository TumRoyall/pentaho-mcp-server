import { findLifecycleResource, lifecycleCatalog, loadLifecycleText } from './catalog.js';

export function listLifecycleResources() {
  return lifecycleCatalog().map(({ uri, name, description, mimeType }) => ({
    uri, name, description, mimeType,
  }));
}

export function readLifecycleResource(uri) {
  const resource = findLifecycleResource(uri);
  if (!resource) throw new Error(`Unknown lifecycle resource: ${uri}`);
  return {
    uri: resource.uri,
    mimeType: resource.mimeType,
    text: loadLifecycleText(resource),
  };
}
