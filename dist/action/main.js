import { appendFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { scan } from '../src/scanner.js';
import { renderMarkdown } from '../src/output/markdown.js';
const RISK_ORDER = ['none', 'low', 'medium', 'high', 'critical'];
function getInput(name, fallback = '') {
    return process.env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] ?? fallback;
}
function setOutput(name, value) {
    const file = process.env.GITHUB_OUTPUT;
    if (file)
        appendFileSync(file, `${name}=${value}\n`);
}
async function postPrComment(token, body) {
    const { GITHUB_REPOSITORY, GITHUB_EVENT_PATH } = process.env;
    if (!GITHUB_REPOSITORY || !GITHUB_EVENT_PATH)
        return;
    const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf-8'));
    const prNumber = event.pull_request?.number;
    if (!prNumber)
        return;
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
    });
}
async function run() {
    const opts = {
        path: resolve(getInput('path', '.')),
        format: 'markdown',
        failOn: getInput('fail-on', 'high'),
        concurrency: 8,
        noEol: getInput('no-eol') === 'true',
        noCve: getInput('no-cve') === 'true',
        noActivity: getInput('no-activity') === 'true',
        noOutdated: getInput('no-outdated') === 'true',
        noTyposquat: getInput('no-typosquat') === 'true',
        noLicense: getInput('no-license') === 'true',
    };
    try {
        const result = await scan(opts);
        const report = renderMarkdown(result);
        console.log(report);
        const token = getInput('github-token');
        if (token && process.env.GITHUB_EVENT_NAME === 'pull_request') {
            await postPrComment(token, report);
        }
        setOutput('risk-level', result.results[0]?.riskLevel ?? 'none');
        const threshold = RISK_ORDER.indexOf(opts.failOn);
        if (threshold > 0) {
            const breached = result.results.some(r => RISK_ORDER.indexOf(r.riskLevel) >= threshold);
            if (breached) {
                console.error(`ossrisk: one or more dependencies are at risk level "${opts.failOn}" or above`);
                process.exit(1);
            }
        }
    }
    catch (err) {
        console.error('ossrisk action failed:', err.message);
        process.exit(2);
    }
}
run();
//# sourceMappingURL=main.js.map