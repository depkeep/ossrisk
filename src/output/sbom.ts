import { randomUUID } from 'crypto';
import { basename, dirname } from 'path';
import type {
  DependencyResult,
  Ecosystem,
  LicenseSignal,
  RiskLevel,
  ScanResult,
} from '../types.js';

// Package-URL type per ecosystem (https://github.com/package-url/purl-spec).
const PURL_TYPE: Record<Ecosystem, string> = {
  npm:   'npm',
  pypi:  'pypi',
  maven: 'maven',
  cargo: 'cargo',
  go:    'golang',
};

// Build a canonical package URL. Scoped npm names (`@scope/name`) split into a
// namespace + name; PyPI names are normalised (lowercase, `_`→`-`) per the
// purl spec. Each component is percent-encoded (`@`→`%40`, etc.).
export function toPurl(dep: { name: string; version: string; ecosystem: Ecosystem }): string {
  const type = PURL_TYPE[dep.ecosystem];

  let namespace = '';
  let name = dep.name;
  const slash = name.indexOf('/');
  if (slash >= 0) {
    namespace = name.slice(0, slash);
    name = name.slice(slash + 1);
  }

  if (dep.ecosystem === 'pypi') {
    namespace = namespace.toLowerCase().replace(/_/g, '-');
    name = name.toLowerCase().replace(/_/g, '-');
  }

  const nsPart = namespace ? `${encodeURIComponent(namespace)}/` : '';
  return `pkg:${type}/${nsPart}${encodeURIComponent(name)}@${encodeURIComponent(dep.version)}`;
}

function declaredLicense(dep: DependencyResult): string | undefined {
  const sig = dep.signals.find((s): s is LicenseSignal => s.type === 'license');
  // A resolved-but-unknown license is not something we can assert.
  if (!sig || sig.category === 'unknown') return undefined;
  return sig.license;
}

// ---- CycloneDX 1.5 (JSON) -------------------------------------------------

// CycloneDX rating severities are a fixed enum; ours line up except that a
// clean CVE never happens, so 'none' collapses to 'unknown' defensively.
const CDX_SEVERITY: Record<RiskLevel, string> = {
  critical: 'critical',
  high:     'high',
  medium:   'medium',
  low:      'low',
  none:     'unknown',
};

export function renderCycloneDx(result: ScanResult, toolVersion: string): string {
  const components = result.results.map(dep => {
    const purl = toPurl(dep);
    const license = declaredLicense(dep);
    return {
      type: 'library',
      'bom-ref': purl,
      name: dep.name,
      version: dep.version,
      purl,
      scope: dep.isDirect ? 'required' : 'optional',
      ...(license ? { licenses: [{ license: { name: license } }] } : {}),
      properties: [
        { name: 'ossrisk:riskLevel', value: dep.riskLevel },
        { name: 'ossrisk:direct', value: String(dep.isDirect) },
        ...(dep.via ? [{ name: 'ossrisk:via', value: dep.via }] : []),
      ],
    };
  });

  const vulnerabilities = result.results.flatMap(dep => {
    const ref = toPurl(dep);
    return dep.signals
      .filter(s => s.type === 'cve')
      .map(s => ({
        'bom-ref': `${ref}#${s.id}`,
        id: s.id,
        source: { name: 'OSV', url: `https://osv.dev/vulnerability/${s.id}` },
        ratings: [{ source: { name: 'OSV' }, severity: CDX_SEVERITY[s.severity] }],
        description: s.summary,
        affects: [{ ref }],
      }));
  });

  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: result.scannedAt,
      tools: [{ vendor: 'depkeep', name: 'ossrisk', version: toolVersion }],
      component: {
        type: 'application',
        'bom-ref': 'root',
        name: basename(dirname(result.manifest)) || 'root',
      },
    },
    components,
    ...(vulnerabilities.length > 0 ? { vulnerabilities } : {}),
  };

  return JSON.stringify(bom, null, 2);
}

// ---- SPDX 2.3 (JSON) ------------------------------------------------------

export function renderSpdx(result: ScanResult, toolVersion: string): string {
  const packages = result.results.map((dep, i) => {
    const license = declaredLicense(dep);
    return {
      SPDXID: `SPDXRef-Package-${i}`,
      name: dep.name,
      versionInfo: dep.version,
      downloadLocation: 'NOASSERTION',
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: license ?? 'NOASSERTION',
      copyrightText: 'NOASSERTION',
      externalRefs: [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: toPurl(dep),
        },
      ],
    };
  });

  const relationships = packages.map(p => ({
    spdxElementId: 'SPDXRef-DOCUMENT',
    relatedSpdxElement: p.SPDXID,
    relationshipType: 'DESCRIBES',
  }));

  const doc = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: basename(dirname(result.manifest)) || 'root',
    documentNamespace: `https://depkeep.dev/ossrisk/${randomUUID()}`,
    creationInfo: {
      created: result.scannedAt,
      creators: [`Tool: ossrisk-${toolVersion}`],
    },
    packages,
    relationships,
  };

  return JSON.stringify(doc, null, 2);
}
