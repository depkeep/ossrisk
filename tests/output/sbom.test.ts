import { describe, it, expect } from 'vitest';
import { renderCycloneDx, renderSpdx, toPurl } from '../../src/output/sbom.js';
import type { ScanResult } from '../../src/types.js';

const base: ScanResult = {
  scannedAt: '2026-01-01T00:00:00.000Z',
  manifest: '/home/me/project/package.json',
  results: [],
  summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, clean: 0 },
};

const withDeps: ScanResult = {
  ...base,
  results: [
    {
      name: 'lodash', version: '4.17.11', ecosystem: 'npm', isDirect: true,
      riskLevel: 'critical',
      signals: [{ type: 'cve', id: 'CVE-2021-23337', severity: 'critical', summary: 'Prototype pollution' }],
    },
    {
      name: '@babel/core', version: '7.20.0', ecosystem: 'npm', isDirect: false, via: 'jest',
      riskLevel: 'low',
      signals: [{ type: 'license', license: 'LGPL-3.0', category: 'weak-copyleft' }],
    },
    {
      name: 'Django', version: '3.2.0', ecosystem: 'pypi', isDirect: true,
      riskLevel: 'high',
      signals: [{ type: 'eol', cycle: '3.2', eolDate: '2024-04-01' }],
    },
  ],
  summary: { total: 3, critical: 1, high: 1, medium: 0, low: 1, clean: 0 },
};

describe('toPurl', () => {
  it('builds a plain npm purl', () => {
    expect(toPurl({ name: 'lodash', version: '4.17.11', ecosystem: 'npm' }))
      .toBe('pkg:npm/lodash@4.17.11');
  });

  it('percent-encodes a scoped npm name', () => {
    expect(toPurl({ name: '@babel/core', version: '7.20.0', ecosystem: 'npm' }))
      .toBe('pkg:npm/%40babel/core@7.20.0');
  });

  it('normalises pypi names to lowercase with dashes', () => {
    expect(toPurl({ name: 'Django_Rest', version: '3.2.0', ecosystem: 'pypi' }))
      .toBe('pkg:pypi/django-rest@3.2.0');
  });

  it('maps go ecosystem to golang', () => {
    expect(toPurl({ name: 'x', version: '1.0.0', ecosystem: 'go' }))
      .toBe('pkg:golang/x@1.0.0');
  });
});

describe('renderCycloneDx', () => {
  it('emits a valid CycloneDX 1.5 envelope', () => {
    const bom = JSON.parse(renderCycloneDx(withDeps, '0.8.0'));
    expect(bom.bomFormat).toBe('CycloneDX');
    expect(bom.specVersion).toBe('1.5');
    expect(bom.serialNumber).toMatch(/^urn:uuid:/);
    expect(bom.metadata.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(bom.metadata.tools[0]).toMatchObject({ name: 'ossrisk', version: '0.8.0' });
    expect(bom.metadata.component.name).toBe('project');
  });

  it('lists every dependency as a component with a purl', () => {
    const bom = JSON.parse(renderCycloneDx(withDeps, '0.8.0'));
    expect(bom.components).toHaveLength(3);
    const lodash = bom.components.find((c: any) => c.name === 'lodash');
    expect(lodash.purl).toBe('pkg:npm/lodash@4.17.11');
    expect(lodash.scope).toBe('required');
    expect(lodash.properties).toContainEqual({ name: 'ossrisk:riskLevel', value: 'critical' });
  });

  it('records declared licenses and via for transitives', () => {
    const bom = JSON.parse(renderCycloneDx(withDeps, '0.8.0'));
    const babel = bom.components.find((c: any) => c.name === '@babel/core');
    expect(babel.scope).toBe('optional');
    expect(babel.licenses[0].license.name).toBe('LGPL-3.0');
    expect(babel.properties).toContainEqual({ name: 'ossrisk:via', value: 'jest' });
  });

  it('surfaces CVEs in the vulnerabilities section', () => {
    const bom = JSON.parse(renderCycloneDx(withDeps, '0.8.0'));
    expect(bom.vulnerabilities).toHaveLength(1);
    const vuln = bom.vulnerabilities[0];
    expect(vuln.id).toBe('CVE-2021-23337');
    expect(vuln.ratings[0].severity).toBe('critical');
    expect(vuln.affects[0].ref).toBe('pkg:npm/lodash@4.17.11');
  });

  it('omits the vulnerabilities section when there are none', () => {
    const bom = JSON.parse(renderCycloneDx(base, '0.8.0'));
    expect(bom.vulnerabilities).toBeUndefined();
    expect(bom.components).toEqual([]);
  });
});

describe('renderSpdx', () => {
  it('emits a valid SPDX 2.3 envelope', () => {
    const doc = JSON.parse(renderSpdx(withDeps, '0.8.0'));
    expect(doc.spdxVersion).toBe('SPDX-2.3');
    expect(doc.dataLicense).toBe('CC0-1.0');
    expect(doc.SPDXID).toBe('SPDXRef-DOCUMENT');
    expect(doc.name).toBe('project');
    expect(doc.documentNamespace).toContain('depkeep.dev/ossrisk/');
    expect(doc.creationInfo.creators).toContain('Tool: ossrisk-0.8.0');
  });

  it('lists packages with purl external refs and license info', () => {
    const doc = JSON.parse(renderSpdx(withDeps, '0.8.0'));
    expect(doc.packages).toHaveLength(3);
    const babel = doc.packages.find((p: any) => p.name === '@babel/core');
    expect(babel.versionInfo).toBe('7.20.0');
    expect(babel.licenseDeclared).toBe('LGPL-3.0');
    expect(babel.externalRefs[0].referenceLocator).toBe('pkg:npm/%40babel/core@7.20.0');
    const lodash = doc.packages.find((p: any) => p.name === 'lodash');
    expect(lodash.licenseDeclared).toBe('NOASSERTION');
  });

  it('relates every package back to the document', () => {
    const doc = JSON.parse(renderSpdx(withDeps, '0.8.0'));
    expect(doc.relationships).toHaveLength(3);
    for (const rel of doc.relationships) {
      expect(rel.spdxElementId).toBe('SPDXRef-DOCUMENT');
      expect(rel.relationshipType).toBe('DESCRIBES');
    }
  });
});
